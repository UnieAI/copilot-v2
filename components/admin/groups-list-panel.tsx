"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2, ChevronDown, ChevronUp, Users, Shield } from "lucide-react"

type GroupRole = "creator" | "editor" | "member"

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

    if (loading) {
        return <p className="text-xs text-muted-foreground px-4 py-2">載入中...</p>
    }

    if (members.length === 0) {
        return <p className="text-xs text-muted-foreground px-4 py-2">尚無成員</p>
    }

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
    group,
    onDelete,
    deleting,
}: {
    group: Group
    onDelete: (id: string) => void
    deleting: boolean
}) {
    const router = useRouter()
    const [expanded, setExpanded] = useState(false)

    return (
        <div className="rounded-xl border border-border/50 bg-background overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3">
                {/* clickable group name → navigate to /g/[id] */}
                <button
                    onClick={() => router.push(`/g/${group.id}`)}
                    className="flex-1 text-left group"
                >
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors truncate">
                        {group.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        {group.memberCount} 位成員
                    </p>
                </button>

                {/* badge for current user's role */}
                {group.currentUserRole && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                        {ROLE_LABELS[group.currentUserRole] || group.currentUserRole}
                    </span>
                )}

                {/* delete */}
                <button
                    onClick={() => onDelete(group.id)}
                    disabled={deleting}
                    title="刪除群組"
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 shrink-0"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>

                {/* expand/collapse member list */}
                <button
                    onClick={() => setExpanded(v => !v)}
                    title={expanded ? "收闔成員清單" : "展開成員清單"}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                    {expanded
                        ? <ChevronUp className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />
                    }
                </button>
            </div>

            {expanded && (
                <div className="border-t border-border/30">
                    <GroupMembersList groupId={group.id} />
                </div>
            )}
        </div>
    )
}

export function AdminGroupsListPanel() {
    const router = useRouter()
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [creatingName, setCreatingName] = useState("")
    const [creating, setCreating] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const fetchGroups = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/admin/groups")
            if (res.ok) setGroups(await res.json())
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchGroups() }, [fetchGroups])

    const createGroup = async () => {
        if (!creatingName.trim()) return
        setCreating(true)
        try {
            const res = await fetch("/api/admin/groups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: creatingName.trim() }),
            })
            if (!res.ok) { toast.error("建立失敗"); return }
            const created = await res.json()
            toast.success("群組已建立")
            setCreatingName("")
            setShowCreate(false)
            // Navigate directly to the group detail page
            router.push(`/g/${created.id}`)
        } finally {
            setCreating(false)
        }
    }

    const deleteGroup = async (id: string) => {
        const g = groups.find(g => g.id === id)
        if (!g) return
        if (!confirm(`確定要刪除群組「${g.name}」？此操作無法復原。`)) return
        setDeletingId(id)
        try {
            const res = await fetch(`/api/admin/groups/${id}`, { method: "DELETE" })
            if (!res.ok) { toast.error("刪除失敗"); return }
            toast.success("已刪除")
            await fetchGroups()
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="space-y-4">
            {/* Header actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>共 {groups.length} 個群組</span>
                </div>
                <button
                    onClick={() => setShowCreate(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors"
                >
                    <Plus className="h-3.5 w-3.5" />
                    新增群組
                </button>
            </div>

            {/* Create form */}
            {showCreate && (
                <div className="flex gap-2 p-3 rounded-xl border border-border/60 bg-muted/20">
                    <input
                        autoFocus
                        className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="群組名稱"
                        value={creatingName}
                        onChange={e => setCreatingName(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === "Enter") createGroup()
                            if (e.key === "Escape") setShowCreate(false)
                        }}
                    />
                    <button
                        onClick={createGroup}
                        disabled={creating || !creatingName.trim()}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                        {creating ? "建立中..." : "建立"}
                    </button>
                    <button
                        onClick={() => setShowCreate(false)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                        取消
                    </button>
                </div>
            )}

            {/* Groups list */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 rounded-xl border border-border/40 bg-muted/20 animate-pulse" />
                    ))}
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
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
