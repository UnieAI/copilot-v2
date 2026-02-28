"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Plus, Trash2, RefreshCw, Pencil, Check, X, Users, Server, ChevronDown, ChevronUp } from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────────

type Group = {
    id: string
    name: string
    memberCount: number
    providerCount: number
    createdAt: string
}

type User = {
    id: string
    name: string | null
    email: string
    role: string
    image: string | null
}

type GroupProvider = {
    id: string
    groupId: string
    enable: number
    displayName: string
    prefix: string
    apiUrl: string
    apiKey: string
    modelList: any[]
    selectedModels: string[]
    updatedAt: string
}

// ─── Helper: masked API key ──────────────────────────────────────────────────
function maskKey(key: string) {
    if (!key || key.length < 6) return "••••••"
    return key.slice(0, 4) + "•".repeat(Math.min(key.length - 6, 12)) + key.slice(-2)
}

// ─── Model Selector Checklist ────────────────────────────────────────────────
function ModelChecklist({
    groupId,
    provider,
    onSaved,
}: {
    groupId: string
    provider: GroupProvider
    onSaved: () => void
}) {
    const allModels = Array.isArray(provider.modelList) ? (provider.modelList as any[]) : []
    const [selected, setSelected] = useState<Set<string>>(
        new Set(Array.isArray(provider.selectedModels) ? provider.selectedModels : [])
    )
    const [saving, setSaving] = useState(false)

    // Sync local state when provider updates
    useEffect(() => {
        setSelected(new Set(Array.isArray(provider.selectedModels) ? provider.selectedModels : []))
    }, [provider.selectedModels])

    const toggleAll = () => {
        if (selected.size === allModels.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(allModels.map((m: any) => m.id || String(m))))
        }
    }

    const toggle = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const save = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/admin/groups/${groupId}/providers/${provider.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ selectedModels: [...selected] }),
            })
            if (!res.ok) { toast.error("儲存失敗"); return }
            toast.success("模型選擇已儲存")
            onSaved()
        } finally {
            setSaving(false)
        }
    }

    if (allModels.length === 0) {
        return (
            <p className="text-xs text-muted-foreground py-2 px-1">
                尚無模型資料，請點擊「重新整理」獲取模型清單
            </p>
        )
    }

    const allChecked = selected.size === allModels.length
    const someChecked = selected.size > 0 && selected.size < allModels.length

    return (
        <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                    <input
                        type="checkbox"
                        checked={allChecked}
                        ref={el => { if (el) el.indeterminate = someChecked }}
                        onChange={toggleAll}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                    />
                    全選 ({selected.size}/{allModels.length})
                </label>
                <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    <Check className="h-3 w-3" />
                    {saving ? "儲存中..." : "套用"}
                </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                {allModels.map((m: any) => {
                    const id = m.id || String(m)
                    return (
                        <label
                            key={id}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs"
                        >
                            <input
                                type="checkbox"
                                checked={selected.has(id)}
                                onChange={() => toggle(id)}
                                className="h-3.5 w-3.5 rounded border-border accent-primary shrink-0"
                            />
                            <span className="font-mono truncate">{id}</span>
                        </label>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Provider Form ───────────────────────────────────────────────────────────
function ProviderForm({
    groupId,
    provider,
    onSave,
    onCancel,
}: {
    groupId: string
    provider?: GroupProvider
    onSave: (created?: GroupProvider) => void
    onCancel: () => void
}) {
    const [form, setForm] = useState({
        displayName: provider?.displayName || "",
        prefix: provider?.prefix || "",
        apiUrl: provider?.apiUrl || "",
        apiKey: provider?.apiKey || "",
        enable: provider ? provider.enable === 1 : true,
    })
    const [saving, setSaving] = useState(false)

    const save = async () => {
        setSaving(true)
        try {
            const url = provider
                ? `/api/admin/groups/${groupId}/providers/${provider.id}`
                : `/api/admin/groups/${groupId}/providers`
            const method = provider ? "PATCH" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err.error || "儲存失敗")
                return
            }
            const data = await res.json()
            toast.success(provider ? "更新完成" : `新增完成${data.modelList?.length > 0 ? `，已自動獲取 ${data.modelList.length} 個模型` : ""}`)
            onSave(data)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">顯示名稱</label>
                    <input
                        className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        value={form.displayName}
                        onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                        placeholder="e.g. OpenAI"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Prefix <span className="text-muted-foreground/60">(4碼英數，全局唯一)</span>
                    </label>
                    <input
                        className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                        value={form.prefix}
                        onChange={e => setForm(f => ({ ...f, prefix: e.target.value.toUpperCase().slice(0, 4) }))}
                        placeholder="GRPA"
                        disabled={!!provider}
                        maxLength={4}
                    />
                </div>
            </div>
            <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">API URL</label>
                <input
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.apiUrl}
                    onChange={e => setForm(f => ({ ...f, apiUrl: e.target.value }))}
                    placeholder="https://api.openai.com"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">API Key</label>
                <input
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                    type="password"
                    value={form.apiKey}
                    onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                    placeholder="sk-..."
                />
            </div>
            <div className="flex items-center gap-2">
                <input
                    id={`enable-${provider?.id || "new"}`}
                    type="checkbox"
                    checked={form.enable}
                    onChange={e => setForm(f => ({ ...f, enable: e.target.checked }))}
                    className="h-4 w-4 rounded border-border accent-primary"
                />
                <label htmlFor={`enable-${provider?.id || "new"}`} className="text-sm">啟用</label>
            </div>
            <div className="flex gap-2 pt-1">
                <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    <Check className="h-3.5 w-3.5" />
                    {saving ? (provider ? "儲存中..." : "建立並獲取模型...") : (provider ? "儲存" : "建立")}
                </button>
                <button
                    onClick={onCancel}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors"
                >
                    <X className="h-3.5 w-3.5" />
                    取消
                </button>
            </div>
        </div>
    )
}

// ─── Provider Row ────────────────────────────────────────────────────────────
function ProviderRow({
    groupId,
    provider,
    onRefresh,
}: {
    groupId: string
    provider: GroupProvider
    onRefresh: () => void
}) {
    const [editing, setEditing] = useState(false)
    const [showModels, setShowModels] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const syncModels = async () => {
        setSyncing(true)
        try {
            const res = await fetch(`/api/admin/groups/${groupId}/providers/${provider.id}/sync`, { method: "POST" })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err.error || "同步失敗")
                return
            }
            const data = await res.json()
            toast.success(`已更新 ${data.modelList?.length ?? 0} 個模型`)
            onRefresh()
            setShowModels(true)
        } finally {
            setSyncing(false)
        }
    }

    const deleteProvider = async () => {
        if (!confirm(`確定要刪除 Provider「${provider.displayName || provider.prefix}」？`)) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/groups/${groupId}/providers/${provider.id}`, { method: "DELETE" })
            if (!res.ok) { toast.error("刪除失敗"); return }
            toast.success("已刪除")
            onRefresh()
        } finally {
            setDeleting(false)
        }
    }

    if (editing) {
        return (
            <ProviderForm
                groupId={groupId}
                provider={provider}
                onSave={() => { setEditing(false); onRefresh() }}
                onCancel={() => setEditing(false)}
            />
        )
    }

    const modelCount = Array.isArray(provider.modelList) ? provider.modelList.length : 0
    const selectedCount = Array.isArray(provider.selectedModels) ? provider.selectedModels.length : 0

    return (
        <div className="rounded-lg border border-border/40 bg-background overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-2 py-2 px-3 text-sm">
                <div
                    className={`h-2 w-2 rounded-full shrink-0 ${provider.enable ? "bg-green-500" : "bg-muted-foreground/40"}`}
                />
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                    {provider.prefix}
                </span>
                <span className="font-medium flex-1 truncate">{provider.displayName || provider.prefix}</span>
                <button
                    onClick={() => setShowModels(v => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 flex items-center gap-1"
                >
                    {modelCount > 0
                        ? `${selectedCount > 0 ? selectedCount : "全部"} / ${modelCount} 模型`
                        : "無模型"}
                    {showModels ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                <span className="text-xs text-muted-foreground/60 truncate max-w-[120px] hidden lg:block">{maskKey(provider.apiKey)}</span>
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={syncModels}
                        disabled={syncing}
                        title="重新整理模型清單"
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={() => setEditing(true)}
                        title="編輯"
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={deleteProvider}
                        disabled={deleting}
                        title="刪除"
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Expandable model checklist */}
            {showModels && (
                <div className="border-t border-border/30 px-3 pb-3">
                    <ModelChecklist groupId={groupId} provider={provider} onSaved={onRefresh} />
                </div>
            )}
        </div>
    )
}

// ─── Group Detail Panel ──────────────────────────────────────────────────────
function GroupDetail({
    group,
    allUsers,
    onGroupUpdated,
}: {
    group: Group
    allUsers: User[]
    onGroupUpdated: () => void
}) {
    const [tab, setTab] = useState<"members" | "providers">("members")
    const [members, setMembers] = useState<User[]>([])
    const [providers, setProviders] = useState<GroupProvider[]>([])
    const [loading, setLoading] = useState(false)
    const [addingProvider, setAddingProvider] = useState(false)
    const [saving, setSaving] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    const fetchMembers = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/groups/${group.id}/members`)
            const data = await res.json()
            setMembers(data)
            setSelectedIds(new Set(data.map((u: User) => u.id)))
        } finally {
            setLoading(false)
        }
    }, [group.id])

    const fetchProviders = useCallback(async () => {
        const res = await fetch(`/api/admin/groups/${group.id}/providers`)
        const data = await res.json()
        setProviders(data)
    }, [group.id])

    useEffect(() => {
        fetchMembers()
        fetchProviders()
    }, [fetchMembers, fetchProviders])

    const toggleMember = (userId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            next.has(userId) ? next.delete(userId) : next.add(userId)
            return next
        })
    }

    const saveMembers = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/admin/groups/${group.id}/members`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userIds: [...selectedIds] }),
            })
            if (!res.ok) { toast.error("儲存成員失敗"); return }
            toast.success("成員已更新")
            onGroupUpdated()
            await fetchMembers()
        } finally {
            setSaving(false)
        }
    }

    const ROLE_LABELS: Record<string, string> = {
        super: "超級管理員", admin: "管理員", user: "用戶", pending: "待審核",
    }

    return (
        <div className="flex-1 overflow-hidden flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-border/40 bg-muted/20 shrink-0">
                {(["members", "providers"] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${tab === t
                            ? "border-primary text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {t === "members" ? <Users className="h-4 w-4" /> : <Server className="h-4 w-4" />}
                        {t === "members" ? "成員管理" : "Provider 設定"}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {tab === "members" && (
                    <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">勾選要加入此群組的使用者</p>
                        <div className="space-y-1 max-h-[400px] overflow-y-auto">
                            {loading ? (
                                <p className="text-sm text-muted-foreground text-center py-4">載入中...</p>
                            ) : allUsers.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">尚無使用者</p>
                            ) : (
                                allUsers.map(u => (
                                    <label
                                        key={u.id}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(u.id)}
                                            onChange={() => toggleMember(u.id)}
                                            className="h-4 w-4 rounded border-border accent-primary"
                                        />
                                        {u.image ? (
                                            <img src={u.image} className="h-7 w-7 rounded-full object-cover" alt="" />
                                        ) : (
                                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                {u.name?.[0]?.toUpperCase() || "?"}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{u.name || "(未命名)"}</p>
                                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                        </div>
                                        <span className="text-xs text-muted-foreground shrink-0">{ROLE_LABELS[u.role] || u.role}</span>
                                    </label>
                                ))
                            )}
                        </div>
                        <button
                            onClick={saveMembers}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                            <Check className="h-4 w-4" />
                            {saving ? "儲存中..." : "儲存成員設定"}
                        </button>
                    </div>
                )}

                {tab === "providers" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">設定此群組可用的 AI Provider，並勾選要開放的模型</p>
                            <button
                                onClick={() => setAddingProvider(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                新增 Provider
                            </button>
                        </div>

                        {addingProvider && (
                            <ProviderForm
                                groupId={group.id}
                                onSave={(created) => {
                                    setAddingProvider(false)
                                    fetchProviders()
                                    // Auto-expand model list if models were fetched
                                    const count = created?.modelList?.length ?? 0
                                    if (count > 0) {
                                        toast.success(`已自動獲取 ${count} 個模型，請勾選要開放的模型`)
                                    }
                                }}
                                onCancel={() => setAddingProvider(false)}
                            />
                        )}

                        {providers.length === 0 && !addingProvider ? (
                            <p className="text-sm text-muted-foreground text-center py-6">尚未設定任何 Provider</p>
                        ) : (
                            <div className="space-y-2">
                                {providers.map(p => (
                                    <ProviderRow
                                        key={p.id}
                                        groupId={group.id}
                                        provider={p}
                                        onRefresh={fetchProviders}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Main GroupsPanel ─────────────────────────────────────────────────────────
export function GroupsPanel({ allUsers }: { allUsers: User[] }) {
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
    const [creatingName, setCreatingName] = useState("")
    const [creating, setCreating] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState("")
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const fetchGroups = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/admin/groups")
            const data = await res.json()
            setGroups(data)
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
            await fetchGroups()
            setSelectedGroupId(created.id)
        } finally {
            setCreating(false)
        }
    }

    const renameGroup = async (id: string) => {
        if (!editingName.trim()) return
        const res = await fetch(`/api/admin/groups/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: editingName.trim() }),
        })
        if (!res.ok) { toast.error("更名失敗"); return }
        toast.success("已更名")
        setEditingId(null)
        await fetchGroups()
    }

    const deleteGroup = async (id: string) => {
        const g = groups.find(g => g.id === id)
        if (!confirm(`確定要刪除群組「${g?.name}」？`)) return
        setDeletingId(id)
        try {
            const res = await fetch(`/api/admin/groups/${id}`, { method: "DELETE" })
            if (!res.ok) { toast.error("刪除失敗"); return }
            toast.success("已刪除")
            if (selectedGroupId === id) setSelectedGroupId(null)
            await fetchGroups()
        } finally {
            setDeletingId(null)
        }
    }

    const selectedGroup = groups.find(g => g.id === selectedGroupId)

    return (
        <div className="flex h-full gap-6">
            {/* Left: Group List */}
            <div className="w-72 shrink-0 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">群組清單</h2>
                    <button
                        onClick={() => setShowCreate(v => !v)}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        新增
                    </button>
                </div>

                {showCreate && (
                    <div className="flex gap-2">
                        <input
                            autoFocus
                            className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="群組名稱"
                            value={creatingName}
                            onChange={e => setCreatingName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") createGroup() }}
                        />
                        <button
                            onClick={createGroup}
                            disabled={creating || !creatingName.trim()}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                            {creating ? "..." : "建立"}
                        </button>
                    </div>
                )}

                <div className="space-y-1 flex-1 overflow-y-auto">
                    {loading ? (
                        <p className="text-sm text-muted-foreground text-center py-8">載入中...</p>
                    ) : groups.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">尚無群組，點擊「新增」建立第一個群組</p>
                    ) : (
                        groups.map(g => (
                            <div
                                key={g.id}
                                onClick={() => setSelectedGroupId(g.id === selectedGroupId ? null : g.id)}
                                className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${g.id === selectedGroupId
                                    ? "bg-primary/10 text-primary"
                                    : "hover:bg-muted/60"
                                    }`}
                            >
                                {editingId === g.id ? (
                                    <input
                                        autoFocus
                                        className="flex-1 text-sm rounded border border-input bg-background px-2 py-0.5 focus:outline-none"
                                        value={editingName}
                                        onChange={e => setEditingName(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                        onKeyDown={e => {
                                            if (e.key === "Enter") renameGroup(g.id)
                                            if (e.key === "Escape") setEditingId(null)
                                        }}
                                    />
                                ) : (
                                    <span className="flex-1 text-sm font-medium truncate">{g.name}</span>
                                )}
                                <span className="text-[10px] text-muted-foreground shrink-0">{g.memberCount}人</span>
                                {editingId === g.id ? (
                                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => renameGroup(g.id)} className="text-primary"><Check className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => setEditingId(null)} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                                    </div>
                                ) : (
                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => { setEditingId(g.id); setEditingName(g.name) }}
                                            className="p-1 rounded hover:bg-muted text-muted-foreground"
                                        ><Pencil className="h-3 w-3" /></button>
                                        <button
                                            onClick={() => deleteGroup(g.id)}
                                            disabled={deletingId === g.id}
                                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                        ><Trash2 className="h-3 w-3" /></button>
                                    </div>
                                )}
                                {g.id === selectedGroupId
                                    ? <ChevronUp className="h-3.5 w-3.5 text-primary shrink-0" />
                                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                                }
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right: Group Detail */}
            <div className="flex-1 rounded-2xl border border-border/40 bg-background shadow-sm overflow-hidden flex flex-col">
                {selectedGroup ? (
                    <>
                        <div className="px-5 py-4 border-b border-border/40 shrink-0">
                            <h2 className="text-base font-semibold">{selectedGroup.name}</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {selectedGroup.memberCount} 位成員 · {selectedGroup.providerCount} 個 Provider
                            </p>
                        </div>
                        <GroupDetail
                            group={selectedGroup}
                            allUsers={allUsers}
                            onGroupUpdated={fetchGroups}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                        ← 從左側選擇一個群組進行編輯
                    </div>
                )}
            </div>
        </div>
    )
}
