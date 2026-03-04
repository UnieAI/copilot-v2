"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2, Pencil, Check, X, Users, Server, BarChart3, Shield, ChevronLeft } from "lucide-react"
import { Group, User, Member, GroupRole } from "./group-types"
import { ProviderSection } from "./group-provider-section"
import { UsageSection, QuotaSection } from "./group-usage-quota-section"
import { Button } from "../ui/button"

type Tab = "members" | "providers" | "usage" | "quota"

const SYS_ROLE_LABELS: Record<string, string> = { super: "超級管理員", admin: "管理員", user: "用戶", pending: "待審核" }

function MembersSection({ group, allUsers, currentUserId, currentUserSysRole, canManageMembers, members, onMembersChange }: {
    group: Group; allUsers: User[]; currentUserId: string; currentUserSysRole: string
    canManageMembers: boolean; members: Member[]; onMembersChange: (members: Member[]) => void
}) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(members.map(m => m.id)))
    const [memberRoles, setMemberRoles] = useState<Map<string, GroupRole>>(new Map(members.map(m => [m.id, m.membershipRole])))
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [memberSearch, setMemberSearch] = useState("")
    const router = useRouter()

    // Sync when parent members change (e.g. after save)
    useEffect(() => {
        setSelectedIds(new Set(members.map(m => m.id)))
        setMemberRoles(new Map(members.map(m => [m.id, m.membershipRole])))
    }, [members])

    // ── Permission context ──────────────────────────────────────────────────
    // "full" = isSysAdmin OR groupRole=creator => existing unrestricted logic
    // "editor" = sysRole=user AND groupRole=editor => restricted editor
    // "member" = sysRole=user AND groupRole=member => view-only + self-leave
    const myGroupRole = group.currentUserRole   // "creator"|"editor"|"member"|null
    const isSysPrivileged = ["admin", "super"].includes(currentUserSysRole)
    const permMode: "full" | "editor" | "member" =
        isSysPrivileged || myGroupRole === "creator" ? "full"
            : myGroupRole === "editor" ? "editor"
                : "member"

    // For a given target member row, what can the current user do?
    function getRowPerms(targetId: string, targetMembershipRole: GroupRole) {
        const isSelf = targetId === currentUserId
        const isCreator = group.creatorId === targetId || targetMembershipRole === "creator"

        if (permMode === "full") {
            // Full control — existing logic
            return {
                canChangeRole: !isCreator,
                canRemove: !isCreator,
                removeLabel: isSelf ? "退出" : "移除",
            }
        }
        if (permMode === "editor") {
            // Cannot touch creators or other editors; CAN touch members; can leave self
            const targetIsEditorOrAbove = targetMembershipRole === "editor" || isCreator
            return {
                canChangeRole: !isSelf && !targetIsEditorOrAbove,
                canRemove: (!targetIsEditorOrAbove) || isSelf,
                removeLabel: isSelf ? "退出" : "移除",
            }
        }
        // "member" — view only, but self can leave
        return {
            canChangeRole: false,
            canRemove: isSelf && !isCreator,
            removeLabel: "退出",
        }
    }

    const selectedMembers = useMemo(() => [...selectedIds].map(id => allUsers.find(u => u.id === id) || { id } as User), [selectedIds, allUsers])
    const candidateMembers = useMemo(() => {
        const q = memberSearch.trim().toLowerCase()
        return allUsers.filter(u => !selectedIds.has(u.id)).filter(u => !q || u.email?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q)).slice(0, 8)
    }, [allUsers, selectedIds, memberSearch])

    const addMember = (userId: string) => {
        setSelectedIds(prev => new Set(prev).add(userId))
        setMemberRoles(prev => { const n = new Map(prev); if (!n.has(userId)) n.set(userId, "member"); return n })
        setMemberSearch("")
    }

    // "Leave" for self (editor or member) — calls the dedicated leave API then redirects
    const leaveGroup = async () => {
        if (!confirm("確定要退出此群組？")) return
        const res = await fetch(`/api/groups/${group.id}/leave`, { method: "DELETE" })
        if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            toast.error(body?.error || "退出失敗")
            return
        }
        toast.success("已退出群組")
        router.push("/group")
    }

    // "Remove" for another member (editor mode only, target must be "member")
    const removeMember = (userId: string) => {
        if (group.creatorId && userId === group.creatorId) return
        setSelectedIds(prev => { const n = new Set(prev); n.delete(userId); return n })
        setMemberRoles(prev => { const n = new Map(prev); n.delete(userId); return n })
    }

    const handleRemoveOrLeave = (userId: string, targetMembershipRole: GroupRole) => {
        const isSelf = userId === currentUserId
        if (isSelf) {
            leaveGroup()
        } else {
            removeMember(userId)
        }
    }

    const changeRole = (userId: string, role: GroupRole) => {
        if (group.creatorId && userId === group.creatorId) return
        setMemberRoles(prev => { const n = new Map(prev); n.set(userId, role); return n })
        setSelectedIds(prev => new Set(prev).add(userId))
    }

    const saveMembers = async () => {
        const selected = [...selectedIds]
        if (selected.length === 0) { toast.error("至少需要一位成員"); return }
        if (group.creatorId && !selected.includes(group.creatorId)) { toast.error("建立者必須保留在群組中"); return }
        setSaving(true)
        try {
            const res = await fetch(`/api/admin/groups/${group.id}/members`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ members: selected.map(id => ({ userId: id, role: memberRoles.get(id) || "member" })) }) })
            if (!res.ok) { toast.error("儲存成員失敗"); return }
            toast.success("成員已更新")
            const newMembers: Member[] = selected.map(id => {
                const u = allUsers.find(u => u.id === id) || { id, name: null, email: "", role: "user", image: null } as User
                return { ...u, membershipRole: memberRoles.get(id) || "member" }
            })
            onMembersChange(newMembers)
        } finally { setSaving(false) }
    }

    // Whether to show the "save" button — only full/editor managing others
    const showSaveButton = permMode === "full" || permMode === "editor"
    // Whether to show the search/add input
    const showAddInput = permMode === "full" || permMode === "editor"

    const hintText =
        permMode === "full" ? "輸入 Email/名字搜尋並加入成員，設定角色"
            : permMode === "editor" ? "可搜尋加入成員；不可調整共編者或建立者"
                : "僅檢視成員清單，可退出此群組"

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{hintText}</p>
            </div>
            {showAddInput && (
                <div className="space-y-2">
                    <input type="text" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="輸入 Email 或名字搜尋" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                    {memberSearch.trim() && (
                        <div className="space-y-1 rounded-lg border border-border/60 p-2 max-h-48 overflow-y-auto">
                            {candidateMembers.length === 0 ? <p className="text-xs text-muted-foreground text-center py-2">找不到符合的使用者</p>
                                : candidateMembers.map(u => (
                                    <button key={u.id} onClick={() => addMember(u.id)} className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors text-left">
                                        {u.image ? <img src={u.image} className="h-7 w-7 rounded-full object-cover" alt="" /> : <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">{u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "?"}</div>}
                                        <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{u.name || "(未命名)"}</p><p className="text-xs text-muted-foreground truncate">{u.email}</p></div>
                                        <span className="text-[11px] text-muted-foreground shrink-0">{SYS_ROLE_LABELS[u.role] || u.role}</span>
                                    </button>
                                ))}
                        </div>
                    )}
                </div>
            )}
            {loading ? <p className="text-sm text-muted-foreground text-center py-4">載入中...</p>
                : selectedMembers.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">尚未加入成員</p>
                    : (
                        <div className="space-y-2">
                            {selectedMembers.map(u => {
                                const role = memberRoles.get(u.id) || "member"
                                const isCreator = group.creatorId === u.id
                                const { canChangeRole, canRemove, removeLabel } = getRowPerms(u.id, role as GroupRole)
                                return (
                                    <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/60">
                                        {u.image ? <img src={u.image} className="h-8 w-8 rounded-full object-cover" alt="" /> : <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">{u.name?.[0]?.toUpperCase() || (u as any).email?.[0]?.toUpperCase() || "?"}</div>}
                                        <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{u.name || "(未命名)"}</p><p className="text-xs text-muted-foreground truncate">{(u as any).email}</p></div>
                                        <select value={role} onChange={e => changeRole(u.id, e.target.value as GroupRole)} disabled={!canChangeRole} className="text-xs border border-border rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-default">
                                            {isCreator && <option value="creator">創建者</option>}
                                            <option value="editor">共編者</option>
                                            <option value="member">成員</option>
                                        </select>
                                        {canRemove && (
                                            <button onClick={() => handleRemoveOrLeave(u.id, role as GroupRole)}
                                                className={`text-xs hover:underline shrink-0 ${removeLabel === "退出" ? "text-amber-500" : "text-destructive"}`}>
                                                {removeLabel}
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
            {showSaveButton && (
                <button onClick={saveMembers} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    <Check className="h-4 w-4" />{saving ? "儲存中..." : "儲存成員設定"}
                </button>
            )}
        </div>
    )
}


export function GroupDetailPage({ group: initialGroup, allUsers, isSysAdmin, initialMembers, currentUserId, currentUserSysRole }: {
    group: Group; allUsers: User[]; isSysAdmin: boolean; initialMembers: Member[]
    currentUserId: string; currentUserSysRole: string
}) {
    const router = useRouter()
    const [group, setGroup] = useState<Group>(initialGroup)
    const [members, setMembers] = useState<Member[]>(initialMembers)
    const [tab, setTab] = useState<Tab>("members")
    const [editingName, setEditingName] = useState(false)
    const [nameValue, setNameValue] = useState(group.name)
    const [deletingGroup, setDeletingGroup] = useState(false)

    const userRole = group.currentUserRole
    const canDelete = isSysAdmin || userRole === "creator"
    const canEditName = isSysAdmin || userRole === "creator" || userRole === "editor"
    const canManageMembers = isSysAdmin || userRole === "creator" || userRole === "editor"
    const canEditProviders = isSysAdmin || userRole === "creator" || userRole === "editor"
    const canSeeQuota = isSysAdmin || userRole === "creator" || userRole === "editor"
    const canSeeUsage = isSysAdmin || userRole === "creator" || userRole === "editor"

    const tabs: Tab[] = ["members", "providers", ...(canSeeQuota ? ["quota" as Tab] : []), ...(canSeeUsage ? ["usage" as Tab] : [])]

    // When members change, update memberCount in group state
    const handleMembersChange = useCallback((newMembers: Member[]) => {
        setMembers(newMembers)
        setGroup(g => ({ ...g, memberCount: newMembers.length }))
    }, [])

    // When provider count changes (callback from ProviderSection)
    const handleProviderCountChange = useCallback((count: number) => {
        setGroup(g => ({ ...g, providerCount: count }))
    }, [])

    const renameGroup = async () => {
        if (!nameValue.trim()) return
        const res = await fetch(`/api/admin/groups/${group.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nameValue.trim() }) })
        if (!res.ok) { toast.error("更名失敗"); return }
        const updated = await res.json()
        setGroup(g => ({ ...g, name: updated.name }))
        toast.success("已更名"); setEditingName(false)
    }

    const deleteGroup = async () => {
        if (!confirm(`確定要永久刪除群組「${group.name}」？此操作無法復原。`)) return
        setDeletingGroup(true)
        try {
            const res = await fetch(`/api/admin/groups/${group.id}`, { method: "DELETE" })
            if (!res.ok) { toast.error("刪除失敗"); return }
            toast.success("群組已刪除"); router.push("/admin/groups")
        } finally { setDeletingGroup(false) }
    }

    const TAB_ICONS: Record<Tab, React.ReactNode> = {
        members: <Users className="h-4 w-4" />,
        providers: <Server className="h-4 w-4" />,
        usage: <BarChart3 className="h-4 w-4" />,
        quota: <Shield className="h-4 w-4" />,
    }
    const TAB_LABELS: Record<Tab, string> = { members: "成員管理", providers: "Provider 設定", usage: "用量", quota: "額度" }

    const roleLabel = userRole === "creator" ? "創建者" : userRole === "editor" ? "共編者" : userRole === "member" ? "成員" : null

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="sticky top-0 z-10 flex-shrink-0 border-b border-border/40 bg-background/95 backdrop-blur px-6 py-4 md:px-8">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={() => {
                            // router.back()
                            router.push('/group')
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
                        <ChevronLeft className="size-4" />
                        我的群組
                    </Button>
                    <div className="flex-1 min-w-0">
                        {editingName ? (
                            <div className="flex items-center gap-2">
                                <input autoFocus value={nameValue} onChange={e => setNameValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") renameGroup(); if (e.key === "Escape") setEditingName(false) }} className="text-xl font-medium bg-transparent border-b border-primary focus:outline-none" />
                                <button onClick={renameGroup} className="text-primary"><Check className="h-4 w-4" /></button>
                                <button onClick={() => setEditingName(false)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl md:text-2xl font-medium tracking-tight truncate">{group.name}</h1>
                                {canEditName && <button onClick={() => { setNameValue(group.name); setEditingName(true) }} className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors shrink-0"><Pencil className="h-4 w-4" /></button>}
                            </div>
                        )}
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {group.memberCount} 位成員 · {group.providerCount} 個 Provider{roleLabel ? ` · 你的角色：${roleLabel}` : ""}
                        </p>
                    </div>
                    {canDelete && (
                        <button onClick={deleteGroup} disabled={deletingGroup} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />{deletingGroup ? "刪除中..." : "刪除群組"}
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border/40 bg-muted/20 shrink-0 px-6 md:px-8">
                <div className="max-w-4xl w-full mx-auto flex">
                    {tabs.map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                            {TAB_ICONS[t]}{TAB_LABELS[t]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
                <div className="max-w-4xl mx-auto">
                    {tab === "members" && (
                        <MembersSection
                            group={group}
                            allUsers={allUsers}
                            currentUserId={currentUserId}
                            currentUserSysRole={currentUserSysRole}
                            canManageMembers={canManageMembers}
                            members={members}
                            onMembersChange={handleMembersChange}
                        />
                    )}
                    {tab === "providers" && (
                        <ProviderSection groupId={group.id} canEdit={canEditProviders} onProviderCountChange={handleProviderCountChange} />
                    )}
                    {tab === "quota" && canSeeQuota && (
                        // Only pass actual current members (not allUsers) so quota list stays in sync
                        <QuotaSection group={group} members={members as unknown as User[]} />
                    )}
                    {tab === "usage" && canSeeUsage && <UsageSection group={group} />}
                </div>
            </div>
        </div>
    )
}
