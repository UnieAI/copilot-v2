"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2, ChevronDown, ChevronUp, Users, Shield } from "lucide-react"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"

type GroupRole = "creator" | "editor" | "member"

type SystemUser = {
    id: string
    name: string | null
    email: string
    role: string
    image: string | null
}

type Group = {
    id: string
    name: string
    creatorId: string | null
    currentUserRole?: GroupRole | null
    memberCount: number
    providerCount: number
    createdAt: string
}

type Member = {
    id: string
    name: string | null
    email: string
    role: string
    membershipRole: GroupRole
    image: string | null
}

const ROLE_LABELS: Record<string, string> = {
    creator: "創建者",
    editor: "共編者",
    member: "成員",
}

const SYS_ROLE_LABELS: Record<string, string> = {
    super: "超級管理員",
    admin: "管理員",
    user: "用戶",
    pending: "待審核",
}

function GroupMembersList({ groupId }: { groupId: string }) {
    const [members, setMembers] = useState<Member[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        fetch(`/api/admin/groups/${groupId}/members`)
            .then(r => r.ok ? r.json() : [])
            .then(data => { if (!cancelled) setMembers(data) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [groupId])

    if (loading) return <p className="text-xs text-muted-foreground px-4 py-2">載入中...</p>
    if (members.length === 0) return <p className="text-xs text-muted-foreground px-4 py-2">尚無成員</p>

    return (
        <div className="px-3 pb-3 space-y-1">
            {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-muted/30">
                    {m.image ? (
                        <img src={m.image} className="h-6 w-6 rounded-full object-cover shrink-0" alt="" />
                    ) : (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                            {m.name?.[0]?.toUpperCase() || m.email?.[0]?.toUpperCase() || "?"}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{m.name || "(未命名)"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            {ROLE_LABELS[m.membershipRole] || m.membershipRole}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {SYS_ROLE_LABELS[m.role] || m.role}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    )
}

function GroupRow({
    group, onDelete, deleting, isExpanded, onToggleExpand,
}: {
    group: Group; onDelete: (id: string) => void; deleting: boolean
    isExpanded: boolean; onToggleExpand: (id: string) => void
}) {
    const router = useRouter()
    return (
        <div className="rounded-xl border border-border/50 bg-background overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => router.push(`/g/${group.id}`)} className="flex-1 text-left group">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors truncate">{group.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{group.memberCount} 位成員</p>
                </button>
                {group.currentUserRole && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                        {ROLE_LABELS[group.currentUserRole] || group.currentUserRole}
                    </span>
                )}
                <button onClick={() => onDelete(group.id)} disabled={deleting} title="刪除群組"
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => onToggleExpand(group.id)} title={isExpanded ? "收闔成員清單" : "展開成員清單"}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
            </div>
            {isExpanded && (
                <div className="border-t border-border/30">
                    <GroupMembersList groupId={group.id} />
                </div>
            )}
        </div>
    )
}

// ─── Create Group Dialog ─────────────────────────────────────────────────────
function CreateGroupDialog({ open, onClose, onCreated }: {
    open: boolean; onClose: () => void; onCreated: (groupId: string) => void
}) {
    const [name, setName] = useState("")
    const [allUsers, setAllUsers] = useState<SystemUser[]>([])
    const [usersLoading, setUsersLoading] = useState(false)
    const [search, setSearch] = useState("")
    const [selectedRoles, setSelectedRoles] = useState<Map<string, GroupRole>>(new Map())
    const [creating, setCreating] = useState(false)

    // Fetch users when dialog opens
    useEffect(() => {
        if (!open) return
        setName(""); setSearch(""); setSelectedRoles(new Map())
        setUsersLoading(true)
        fetch("/api/admin/users").then(r => r.ok ? r.json() : []).then(data => {
            setAllUsers(Array.isArray(data) ? data : data.users || [])
        }).finally(() => setUsersLoading(false))
    }, [open])

    const selectedIds = new Set(selectedRoles.keys())

    // Candidates: not yet selected, filtered by search query (only shown when searching)
    const candidateUsers = (() => {
        const q = search.trim().toLowerCase()
        if (!q) return []
        return allUsers
            .filter(u => !selectedIds.has(u.id))
            .filter(u => u.email?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q))
            .slice(0, 8)
    })()

    const selectedUserList = allUsers.filter(u => selectedIds.has(u.id))

    const addMember = (userId: string) => {
        setSelectedRoles(prev => {
            const n = new Map(prev)
            if (!n.has(userId)) n.set(userId, "member")
            return n
        })
        setSearch("")
    }
    const removeMember = (userId: string) => {
        setSelectedRoles(prev => { const n = new Map(prev); n.delete(userId); return n })
    }
    const setMemberRole = (userId: string, role: GroupRole) => {
        setSelectedRoles(prev => { const n = new Map(prev); n.set(userId, role); return n })
    }

    const handleCreate = async () => {
        if (!name.trim()) { toast.error("請輸入群組名稱"); return }
        setCreating(true)
        try {
            const res = await fetch("/api/admin/groups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    extraMembers: [...selectedRoles.entries()].map(([userId, role]) => ({ userId, role })),
                }),
            })
            if (!res.ok) { toast.error("建立失敗"); return }
            const created = await res.json()
            toast.success("群組已建立")
            onCreated(created.id)
        } finally { setCreating(false) }
    }

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>新增群組</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    {/* Group name */}
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">群組名稱 <span className="text-destructive">*</span></label>
                        <input
                            autoFocus
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleCreate() }}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="輸入群組名稱"
                        />
                    </div>

                    {/* Member selector */}
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">新增成員（可選）</label>
                        <p className="text-xs text-muted-foreground mb-2">輸入 Email 或名字搜尋並加入成員，設定角色</p>

                        {/* Search input */}
                        <div className="space-y-2">
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                placeholder="輸入 Email 或名字搜尋"
                                disabled={usersLoading}
                            />

                            {/* Candidate dropdown — only shown when search is non-empty */}
                            {search.trim() && (
                                <div className="space-y-1 rounded-lg border border-border/60 p-2 max-h-48 overflow-y-auto">
                                    {usersLoading ? (
                                        <p className="text-xs text-muted-foreground text-center py-2">載入用戶中...</p>
                                    ) : candidateUsers.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-2">找不到符合的使用者</p>
                                    ) : candidateUsers.map(u => (
                                        <button key={u.id} onClick={() => addMember(u.id)}
                                            className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors text-left">
                                            {u.image
                                                ? <img src={u.image} className="h-7 w-7 rounded-full object-cover shrink-0" alt="" />
                                                : <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">{u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "?"}</div>
                                            }
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{u.name || "(未命名)"}</p>
                                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                            </div>
                                            <span className="text-[11px] text-muted-foreground shrink-0">{SYS_ROLE_LABELS[u.role] || u.role}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Selected members list */}
                        {selectedUserList.length > 0 && (
                            <div className="mt-3 space-y-2">
                                <p className="text-xs text-muted-foreground">已選擇 {selectedUserList.length} 位成員</p>
                                {selectedUserList.map(u => {
                                    const role = selectedRoles.get(u.id) || "member"
                                    return (
                                        <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/60">
                                            {u.image
                                                ? <img src={u.image} className="h-8 w-8 rounded-full object-cover shrink-0" alt="" />
                                                : <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">{u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "?"}</div>
                                            }
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{u.name || "(未命名)"}</p>
                                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                            </div>
                                            <select value={role} onChange={e => setMemberRole(u.id, e.target.value as GroupRole)}
                                                className="text-xs border border-border rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring">
                                                <option value="editor">共編者</option>
                                                <option value="member">成員</option>
                                            </select>
                                            <button onClick={() => removeMember(u.id)} className="text-xs text-destructive hover:underline shrink-0">移除</button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors">取消</button>
                    <button onClick={handleCreate} disabled={creating || !name.trim()}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                        {creating ? "建立中..." : "建立群組"}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─── Main Panel ──────────────────────────────────────────────────────────────
export function AdminGroupsListPanel() {
    const router = useRouter()
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const fetchGroups = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/admin/groups")
            if (res.ok) setGroups(await res.json())
        } finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchGroups() }, [fetchGroups])

    const handleToggleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id)
    }

    const handleCreated = (groupId: string) => {
        setShowCreateDialog(false)
        router.push(`/g/${groupId}`)
    }

    const deleteGroup = async (id: string) => {
        const g = groups.find(g => g.id === id)
        if (!g) return
        if (!confirm(`確定要刪除群組「${g.name}」？此操作無法復原。`)) return
        setDeletingId(id)
        try {
            const res = await fetch(`/api/admin/groups/${id}`, { method: "DELETE" })
            if (!res.ok) { toast.error("刪除失敗"); return }
            toast.success("已刪除"); await fetchGroups()
        } finally { setDeletingId(null) }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>共 {groups.length} 個群組</span>
                </div>
                <button onClick={() => setShowCreateDialog(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors">
                    <Plus className="h-3.5 w-3.5" />新增群組
                </button>
            </div>

            <CreateGroupDialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} onCreated={handleCreated} />

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl border border-border/40 bg-muted/20 animate-pulse" />)}
                </div>
            ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                        <Shield className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">尚無群組</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">點擊「新增群組」建立第一個群組</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {groups.map(g => (
                        <GroupRow
                            key={g.id}
                            group={g}
                            onDelete={deleteGroup}
                            deleting={deletingId === g.id}
                            isExpanded={expandedId === g.id}
                            onToggleExpand={handleToggleExpand}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
