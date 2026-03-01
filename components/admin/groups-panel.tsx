"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { toast } from "sonner"
import { Plus, Trash2, RefreshCw, Pencil, Check, X, Users, Server, ChevronDown, ChevronUp, BarChart3, Shield } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

// ─── Types ──────────────────────────────────────────────────────────────────

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

type User = {
    id: string
    name: string | null
    email: string
    role: string
    image: string | null
}

type Member = User & { membershipRole: GroupRole }

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

type UsageRow = {
    user: { id: string, name?: string | null, email?: string | null, image?: string | null }
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

type UsagePoint = {
    date: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

type UsageByModelRow = {
    user: { id: string, name?: string | null, email?: string | null, image?: string | null }
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

type UserQuota = { userId: string, limitTokens: number | null }
type ModelQuota = { userId: string, model: string, limitTokens: number | null }

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
    readOnly = false,
}: {
    groupId: string
    provider: GroupProvider
    onSaved: () => void
    readOnly?: boolean
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
        if (readOnly) return
        if (selected.size === allModels.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(allModels.map((m: any) => m.id || String(m))))
        }
    }

    const toggle = (id: string) => {
        if (readOnly) return
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
                        disabled={readOnly}
                    />
                    全選 ({selected.size}/{allModels.length})
                </label>
                <button
                    onClick={save}
                    disabled={saving || readOnly}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    <Check className="h-3 w-3" />
                    {saving ? "儲存中..." : readOnly ? "僅檢視" : "套用"}
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
                                disabled={readOnly}
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
    canEdit,
}: {
    groupId: string
    provider: GroupProvider
    onRefresh: () => void
    canEdit: boolean
}) {
    const [editing, setEditing] = useState(false)
    const [showModels, setShowModels] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const syncModels = async () => {
        if (!canEdit) return
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
        if (!canEdit) return
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
                        disabled={syncing || !canEdit}
                        title="重新整理模型清單"
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={() => canEdit && setEditing(true)}
                        title="編輯"
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        disabled={!canEdit}
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={deleteProvider}
                        disabled={deleting || !canEdit}
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
                    <ModelChecklist groupId={groupId} provider={provider} onSaved={onRefresh} readOnly={!canEdit} />
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
    viewerRole,
}: {
    group: Group
    allUsers: User[]
    onGroupUpdated: () => void
    viewerRole: string
}) {
    const [tab, setTab] = useState<"members" | "providers" | "usage">("members")
    const [memberRoles, setMemberRoles] = useState<Map<string, GroupRole>>(new Map())
    const [providers, setProviders] = useState<GroupProvider[]>([])
    const [usage, setUsage] = useState<UsageRow[]>([])
    const [usageSeries, setUsageSeries] = useState<UsagePoint[]>([])
    const [usageByModel, setUsageByModel] = useState<UsageByModelRow[]>([])
    const [usageLoading, setUsageLoading] = useState(false)
    const [userQuotas, setUserQuotas] = useState<Map<string, number | null>>(new Map())
    const [modelQuotas, setModelQuotas] = useState<ModelQuota[]>([])
    const [groupModelQuotas, setGroupModelQuotas] = useState<{ model: string, limitTokens: number | null }[]>([])
    const [savingQuotas, setSavingQuotas] = useState(false)
    const [loading, setLoading] = useState(false)
    const [addingProvider, setAddingProvider] = useState(false)
    const [saving, setSaving] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [rangeStart, setRangeStart] = useState<string>(() => {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        return d.toISOString().slice(0, 10)
    })
    const [rangeEnd, setRangeEnd] = useState<string>(() => new Date().toISOString().slice(0, 10))
    const [newQuotaUser, setNewQuotaUser] = useState<string>("")
    const [newQuotaModel, setNewQuotaModel] = useState<string>("")
    const [newQuotaLimit, setNewQuotaLimit] = useState<string>("")
    const [newQuotaUnlimited, setNewQuotaUnlimited] = useState<boolean>(false)
    const [memberSearch, setMemberSearch] = useState("")

    const isAdminViewer = ["admin", "super"].includes(viewerRole)
    const canEdit = isAdminViewer || ["creator", "editor"].includes(group.currentUserRole || "")

    useEffect(() => {
        if (!canEdit && tab === "usage") setTab("members")
    }, [canEdit, tab])

    const fetchMembers = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/groups/${group.id}/members`)
            if (!res.ok) {
                setSelectedIds(new Set())
                setMemberRoles(new Map())
                return
            }
            const data = await res.json()
            setSelectedIds(new Set(data.map((u: Member) => u.id)))
            setMemberRoles(new Map(data.map((u: any) => [u.id, (u as any).membershipRole || "member"])))
        } finally {
            setLoading(false)
        }
    }, [group.id])

    const fetchProviders = useCallback(async () => {
        const res = await fetch(`/api/admin/groups/${group.id}/providers`)
        if (!res.ok) {
            setProviders([])
            return
        }
        const data = await res.json()
        setProviders(data)
    }, [group.id])

    const fetchUsage = useCallback(async () => {
        if (!canEdit) {
            setUsage([])
            setUsageByModel([])
            setUsageSeries([])
            return
        }
        setUsageLoading(true)
        try {
            const params = new URLSearchParams()
            if (rangeStart) params.set("start", rangeStart)
            if (rangeEnd) params.set("end", rangeEnd)
            const res = await fetch(`/api/admin/groups/${group.id}/usage?${params.toString()}`)
            if (!res.ok) {
                setUsage([])
                setUsageByModel([])
                setUsageSeries([])
                return
            }
            const data = await res.json()
            setUsage(data.perUser || [])
            setUsageByModel(data.perUserModel || [])
            setUsageSeries(data.timeseries || [])
        } finally {
            setUsageLoading(false)
        }
    }, [group.id, canEdit, rangeStart, rangeEnd])

    const fetchQuotas = useCallback(async () => {
        if (!canEdit) {
            setUserQuotas(new Map())
            setModelQuotas([])
            setGroupModelQuotas([])
            return
        }
        const res = await fetch(`/api/admin/groups/${group.id}/quotas`)
        if (!res.ok) {
            setUserQuotas(new Map())
            setModelQuotas([])
            setGroupModelQuotas([])
            return
        }
        const data = await res.json()
        const userMap = new Map<string, number | null>()
        if (Array.isArray(data.userQuotas)) {
            data.userQuotas.forEach((q: any) => userMap.set(q.userId, q.limitTokens === null ? null : Number(q.limitTokens)))
        }
        setUserQuotas(userMap)
        setModelQuotas(Array.isArray(data.modelQuotas) ? data.modelQuotas.map((q: any) => ({
            userId: q.userId,
            model: q.model,
            limitTokens: q.limitTokens === null ? null : Number(q.limitTokens),
        })) : [])
        setGroupModelQuotas(Array.isArray(data.groupModelQuotas) ? data.groupModelQuotas.map((q: any) => ({
            model: q.model,
            limitTokens: q.limitTokens === null ? null : Number(q.limitTokens),
        })) : [])
    }, [group.id, canEdit])

    useEffect(() => {
        fetchMembers()
        fetchProviders()
    }, [fetchMembers, fetchProviders])

    useEffect(() => {
        if (tab === "usage") {
            fetchUsage()
            fetchQuotas()
        }
    }, [tab, fetchUsage, fetchQuotas])

    const changeRole = (userId: string, role: GroupRole) => {
        if (!canEdit) return
        setMemberRoles(prev => {
            const next = new Map(prev)
            next.set(userId, role)
            return next
        })
        setSelectedIds(prev => new Set(prev).add(userId))
    }

    const addMember = (userId: string) => {
        if (!canEdit) return
        setSelectedIds(prev => {
            const next = new Set(prev)
            next.add(userId)
            return next
        })
        setMemberRoles(prev => {
            const next = new Map(prev)
            if (!next.has(userId)) next.set(userId, "member")
            return next
        })
        setMemberSearch("")
    }

    const removeMember = (userId: string) => {
        if (!canEdit) return
        setSelectedIds(prev => {
            const next = new Set(prev)
            next.delete(userId)
            return next
        })
        setMemberRoles(prev => {
            const next = new Map(prev)
            next.delete(userId)
            return next
        })
        setUserQuotas(prev => {
            const next = new Map(prev)
            next.delete(userId)
            return next
        })
        setModelQuotas(prev => prev.filter(q => q.userId !== userId))
    }

    const availableModels = useMemo(() => {
        const set = new Set<string>()
        providers.forEach(p => {
            const selected = Array.isArray(p.selectedModels) ? p.selectedModels : []
            const all = Array.isArray(p.modelList) ? p.modelList : []
            if (selected.length === 0) return // 只顯示已勾選的模型
            all.forEach((m: any) => {
                const id = m.id || String(m)
                if (selected.includes(id)) set.add(id)
            })
        })
        return Array.from(set)
    }, [providers])

    const saveMembers = async () => {
        if (!canEdit) return
        const selected = [...selectedIds]
        if (selected.length === 0) {
            toast.error("至少需要一位成員")
            return
        }
        const hasCreator = selected.some(id => (memberRoles.get(id) || "member") === "creator")
        if (!hasCreator) {
            toast.error("至少需要一位 Creator")
            return
        }

        setSaving(true)
        try {
            const res = await fetch(`/api/admin/groups/${group.id}/members`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    members: selected.map(id => ({
                        userId: id,
                        role: memberRoles.get(id) || "member",
                    })),
                }),
            })
            if (!res.ok) { toast.error("儲存成員失敗"); return }
            toast.success("成員已更新")
            onGroupUpdated()
            await fetchMembers()
        } finally {
            setSaving(false)
        }
    }

    const setUserQuotaValue = (userId: string, value: number | null) => {
        setUserQuotas(prev => {
            const next = new Map(prev)
            next.set(userId, value)
            return next
        })
    }

    const removeModelQuota = (idx: number) => {
        setModelQuotas(prev => prev.filter((_, i) => i !== idx))
    }

    const addModelQuota = (userId: string, model: string, limitTokens: number | null) => {
        if (!userId || !model) return
        setModelQuotas(prev => {
            const filtered = prev.filter(q => !(q.userId === userId && q.model === model))
            return [...filtered, { userId, model, limitTokens }]
        })
    }

    const saveQuotas = async () => {
        if (!canEdit) return
        setSavingQuotas(true)
        try {
            const body = {
                userQuotas: Array.from(userQuotas.entries()).map(([userId, limitTokens]) => ({
                    userId,
                    limitTokens: limitTokens === null || Number.isNaN(Number(limitTokens)) ? null : Number(limitTokens),
                })),
                modelQuotas: modelQuotas.map(q => ({
                    userId: q.userId,
                    model: q.model,
                    limitTokens: q.limitTokens === null || Number.isNaN(Number(q.limitTokens)) ? null : Number(q.limitTokens),
                })),
                groupModelQuotas: groupModelQuotas.map(q => ({
                    model: q.model,
                    limitTokens: q.limitTokens === null || Number.isNaN(Number(q.limitTokens)) ? null : Number(q.limitTokens),
                })),
            }
            const res = await fetch(`/api/admin/groups/${group.id}/quotas`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            if (!res.ok) {
                toast.error("儲存額度失敗")
                return
            }
            toast.success("額度已更新")
        } finally {
            setSavingQuotas(false)
        }
    }

    const ROLE_LABELS: Record<string, string> = {
        super: "超級管理員", admin: "管理員", user: "用戶", pending: "待審核",
    }

    const tabs: Array<"members" | "providers" | "usage" | "quota"> = canEdit ? ["members", "providers", "usage", "quota"] : ["members", "providers"]
    const selectedMembers = useMemo(
        () => [...selectedIds].map(id => allUsers.find(u => u.id === id) || { id } as any),
        [selectedIds, allUsers]
    )
    const candidateMembers = useMemo(() => {
        const query = memberSearch.trim().toLowerCase()
        return allUsers
            .filter(u => !selectedIds.has(u.id))
            .filter(u => !query || (u.email?.toLowerCase().includes(query) || u.name?.toLowerCase().includes(query)))
            .slice(0, 8)
    }, [allUsers, selectedIds, memberSearch])

    return (
        <div className="flex-1 overflow-hidden flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-border/40 bg-muted/20 shrink-0">
                {tabs.map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${tab === t
                            ? "border-primary text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {t === "members" ? <Users className="h-4 w-4" /> : t === "providers" ? <Server className="h-4 w-4" /> : t === "usage" ? <BarChart3 className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                        {t === "members" ? "成員管理" : t === "providers" ? "Provider 設定" : t === "usage" ? "用量" : "額度"}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {tab === "members" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">輸入 Email/名字搜尋並加入成員，設定角色</p>
                            {!canEdit && (
                                <span className="text-[11px] text-muted-foreground">僅檢視模式</span>
                            )}
                        </div>
                        {canEdit && (
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={memberSearch}
                                    onChange={e => setMemberSearch(e.target.value)}
                                    placeholder="輸入 Email 或名字搜尋"
                                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                                {memberSearch.trim() && (
                                    <div className="space-y-1 rounded-lg border border-border/60 p-2 max-h-48 overflow-y-auto">
                                        {candidateMembers.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-2">找不到符合的使用者</p>
                                        ) : candidateMembers.map(u => (
                                            <button
                                                key={u.id}
                                                onClick={() => addMember(u.id)}
                                                className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors text-left"
                                            >
                                                {u.image ? (
                                                    <img src={u.image} className="h-7 w-7 rounded-full object-cover" alt="" />
                                                ) : (
                                                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                        {u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "?"}
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{u.name || "(未命名)"}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                                </div>
                                                <span className="text-[11px] text-muted-foreground shrink-0">{ROLE_LABELS[u.role] || u.role}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            {selectedMembers.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">尚未加入成員</p>
                            ) : selectedMembers.map(u => {
                                const role = memberRoles.get(u.id) || "member"
                                return (
                                    <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/60">
                                        {u.image ? (
                                            <img src={u.image} className="h-8 w-8 rounded-full object-cover" alt="" />
                                        ) : (
                                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                {u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "?"}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{u.name || "(未命名)"}</p>
                                            <p className="text-xs text-muted-foreground truncate">{(u as any).email}</p>
                                        </div>
                                        <select
                                            value={role}
                                            onChange={e => changeRole(u.id, e.target.value as GroupRole)}
                                            disabled={!canEdit}
                                            className="text-xs border border-border rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                        >
                                            <option value="creator">Creator</option>
                                            <option value="editor">共編者</option>
                                            <option value="member">用戶</option>
                                        </select>
                                        {canEdit && (
                                            <button
                                                onClick={() => removeMember(u.id)}
                                                className="text-xs text-destructive hover:underline"
                                            >
                                                移除
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {canEdit && (
                            <button
                                onClick={saveMembers}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                                <Check className="h-4 w-4" />
                                {saving ? "儲存中..." : "儲存成員設定"}
                            </button>
                        )}
                    </div>
                )}

                {tab === "providers" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">設定此群組可用的 AI Provider，並勾選要開放的模型</p>
                            {canEdit && (
                                <button
                                    onClick={() => setAddingProvider(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    新增 Provider
                                </button>
                            )}
                        </div>

                        {addingProvider && canEdit && (
                            <ProviderForm
                                groupId={group.id}
                                onSave={(created) => {
                                    setAddingProvider(false)
                                    fetchProviders()
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
                                        canEdit={canEdit}
                                    />
                                ))}
                            </div>
                        )}
                        {!canEdit && (
                            <p className="text-xs text-muted-foreground text-right">只有 Creator/共編者可以調整 Provider</p>
                        )}
                    </div>
                )}

                {tab === "usage" && canEdit && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">依用戶彙總的 token 使用量</p>
                            <div className="flex items-center gap-2 text-xs">
                                <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">起</span>
                                    <input
                                        type="date"
                                        value={rangeStart}
                                        onChange={(e) => setRangeStart(e.target.value)}
                                        className="rounded-md border border-border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">迄</span>
                                    <input
                                        type="date"
                                        value={rangeEnd}
                                        onChange={(e) => setRangeEnd(e.target.value)}
                                        className="rounded-md border border-border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                </div>
                                <button
                                    onClick={fetchUsage}
                                    className="px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors"
                                    disabled={usageLoading}
                                >
                                    {usageLoading ? "載入中..." : "套用"}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {usageSeries.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">
                                    {usageLoading ? "載入中..." : "尚無用量紀錄"}
                                </p>
                            ) : (
                                <ChartContainer
                                    className="w-full h-64"
                                    config={{
                                        total: { label: "Total", color: "hsl(var(--primary))" },
                                        prompt: { label: "Prompt", color: "hsl(var(--muted-foreground))" },
                                        completion: { label: "Completion", color: "hsl(var(--secondary))" },
                                    }}
                                >
                                    <AreaChart data={usageSeries}>
                                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(value) => value?.slice(5)}
                                            tick={{ fontSize: 12 }}
                                            minTickGap={12}
                                        />
                                        <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => value} />} />
                                        <Area
                                            type="monotone"
                                            dataKey="totalTokens"
                                            stroke="var(--color-total)"
                                            fill="var(--color-total)"
                                            fillOpacity={0.15}
                                            strokeWidth={2}
                                            name="total"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="promptTokens"
                                            stroke="var(--color-prompt)"
                                            fill="var(--color-prompt)"
                                            fillOpacity={0.12}
                                            strokeWidth={1.5}
                                            name="prompt"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="completionTokens"
                                            stroke="var(--color-completion)"
                                            fill="var(--color-completion)"
                                            fillOpacity={0.12}
                                            strokeWidth={1.5}
                                            name="completion"
                                        />
                                    </AreaChart>
                                </ChartContainer>
                            )}

                            {canEdit && (
                                <div className="rounded-xl border border-border/60 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold">用戶總額度</h4>
                                        <button
                                            onClick={saveQuotas}
                                            disabled={savingQuotas}
                                            className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                        >
                                            {savingQuotas ? "儲存中..." : "儲存額度"}
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {allUsers.filter(u => selectedIds.has(u.id)).map(u => {
                                            const limit = userQuotas.get(u.id)
                                            return (
                                                <div key={u.id} className="flex flex-wrap items-center gap-3">
                                                    <div className="flex items-center gap-2 min-w-[180px]">
                                                        {u.image ? (
                                                            <img src={u.image} className="h-7 w-7 rounded-full object-cover" alt="" />
                                                        ) : (
                                                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                                {u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "?"}
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-sm font-medium truncate">{u.name || u.email || "未知用戶"}</span>
                                                            {u.email && <span className="text-xs text-muted-foreground truncate">{u.email}</span>}
                                                        </div>
                                                    </div>
                                                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <input
                                                            type="checkbox"
                                                            checked={limit === null}
                                                            onChange={e => setUserQuotaValue(u.id, e.target.checked ? null : (limit || 0))}
                                                        />
                                                        無上限
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={limit === null || Number.isNaN(limit) ? "" : limit}
                                                        onChange={e => setUserQuotaValue(u.id, e.target.value === "" ? null : Number(e.target.value))}
                                                        disabled={limit === null}
                                                        className="w-32 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                        placeholder="Token 上限"
                                                    />
                                                </div>
                                            )
                                        })}
                                        {allUsers.filter(u => selectedIds.has(u.id)).length === 0 && (
                                            <p className="text-xs text-muted-foreground">尚無成員，無法設定額度。</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {usage.length > 0 && (
                                <div className="rounded-xl border border-border/60 overflow-hidden">
                                    <div className="grid grid-cols-4 gap-2 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                                        <span>用戶</span>
                                        <span className="text-right">Prompt</span>
                                        <span className="text-right">Completion</span>
                                        <span className="text-right">Total</span>
                                    </div>
                                    <div className="divide-y divide-border/60">
                                        {usage.map((u) => (
                                            <div key={u.user.id} className="grid grid-cols-4 gap-2 px-3 py-2 text-sm items-center">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {u.user.image ? (
                                                        <img src={u.user.image} className="h-7 w-7 rounded-full object-cover" alt="" />
                                                    ) : (
                                                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                            {u.user.name?.[0]?.toUpperCase() || u.user.email?.[0]?.toUpperCase() || "?"}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-medium truncate">{u.user.name || u.user.email || "未知用戶"}</span>
                                                        {u.user.email && <span className="text-xs text-muted-foreground truncate">{u.user.email}</span>}
                                                    </div>
                                                </div>
                                                <span className="text-right font-mono text-xs">{u.promptTokens?.toLocaleString?.() ?? u.promptTokens}</span>
                                                <span className="text-right font-mono text-xs">{u.completionTokens?.toLocaleString?.() ?? u.completionTokens}</span>
                                                <span className="text-right font-mono text-xs font-semibold">{u.totalTokens?.toLocaleString?.() ?? u.totalTokens}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {usageByModel.length > 0 && (
                                <div className="rounded-xl border border-border/60 overflow-hidden">
                                    <div className="grid grid-cols-5 gap-2 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                                        <span>用戶</span>
                                        <span>模型</span>
                                        <span className="text-right">Prompt</span>
                                        <span className="text-right">Completion</span>
                                        <span className="text-right">Total</span>
                                    </div>
                                    <div className="divide-y divide-border/60">
                                        {usageByModel.map((u, idx) => (
                                            <div key={`${u.user.id}-${u.model}-${idx}`} className="grid grid-cols-5 gap-2 px-3 py-2 text-sm items-center">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {u.user.image ? (
                                                        <img src={u.user.image} className="h-7 w-7 rounded-full object-cover" alt="" />
                                                    ) : (
                                                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                            {u.user.name?.[0]?.toUpperCase() || u.user.email?.[0]?.toUpperCase() || "?"}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-medium truncate">{u.user.name || u.user.email || "未知用戶"}</span>
                                                        {u.user.email && <span className="text-xs text-muted-foreground truncate">{u.user.email}</span>}
                                                    </div>
                                                </div>
                                                <span className="text-xs font-mono truncate">{u.model}</span>
                                                <span className="text-right font-mono text-xs">{u.promptTokens?.toLocaleString?.() ?? u.promptTokens}</span>
                                                <span className="text-right font-mono text-xs">{u.completionTokens?.toLocaleString?.() ?? u.completionTokens}</span>
                                                <span className="text-right font-mono text-xs font-semibold">{u.totalTokens?.toLocaleString?.() ?? u.totalTokens}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {canEdit && (
                                <div className="rounded-xl border border-border/60 p-4 space-y-3">
                                    <h4 className="text-sm font-semibold">模型額度（依用戶）</h4>
                                    <div className="flex flex-wrap gap-2 items-end">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs text-muted-foreground">用戶</span>
                                            <select
                                                value={newQuotaUser}
                                                onChange={e => setNewQuotaUser(e.target.value)}
                                                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                                            >
                                                <option value="">選擇用戶</option>
                                                {allUsers.filter(u => selectedIds.has(u.id)).map(u => (
                                                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs text-muted-foreground">模型</span>
                                            <select
                                                value={newQuotaModel}
                                                onChange={e => setNewQuotaModel(e.target.value)}
                                                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                                            >
                                                <option value="">選擇模型</option>
                                                {availableModels.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <input
                                                    type="checkbox"
                                                    checked={newQuotaUnlimited}
                                                    onChange={e => setNewQuotaUnlimited(e.target.checked)}
                                                />
                                                無上限
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                value={newQuotaUnlimited ? "" : newQuotaLimit}
                                                onChange={e => setNewQuotaLimit(e.target.value)}
                                                disabled={newQuotaUnlimited}
                                                className="w-32 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                placeholder="Token 上限"
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                const limit = newQuotaUnlimited || newQuotaLimit === "" ? null : Number(newQuotaLimit)
                                                addModelQuota(newQuotaUser, newQuotaModel, limit)
                                                setNewQuotaLimit("")
                                                setNewQuotaUnlimited(false)
                                            }}
                                            className="px-3 py-1.5 rounded-md border border-border text-xs hover:bg-muted transition-colors"
                                            disabled={!newQuotaUser || !newQuotaModel}
                                        >
                                            新增/更新
                                        </button>
                                    </div>
                                    {modelQuotas.length > 0 ? (
                                        <div className="divide-y divide-border/60">
                                            {modelQuotas.map((q, idx) => {
                                                const user = allUsers.find(u => u.id === q.userId)
                                                return (
                                                    <div key={`${q.userId}-${q.model}-${idx}`} className="flex items-center justify-between py-2 text-sm">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-medium truncate">{user?.name || user?.email || q.userId}</span>
                                                                {user?.email && <span className="text-xs text-muted-foreground truncate">{user.email}</span>}
                                                            </div>
                                                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted">{q.model}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs text-muted-foreground">
                                                                {q.limitTokens === null ? "無上限" : q.limitTokens.toLocaleString()}
                                                            </span>
                                                            <button
                                                                onClick={() => removeModelQuota(idx)}
                                                                className="text-xs text-destructive hover:underline"
                                                            >
                                                                移除
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">尚未設定模型額度</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === "quota" && canEdit && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="rounded-2xl border border-border/60 bg-background/60 p-5 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-semibold">用戶總額度</h4>
                                        <p className="text-xs text-muted-foreground mt-1">套用於此群組內所有模型</p>
                                    </div>
                                    <button
                                        onClick={saveQuotas}
                                        disabled={savingQuotas}
                                        className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                    >
                                        {savingQuotas ? "儲存中..." : "儲存"}
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {selectedMembers.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">尚無成員，無法設定額度。</p>
                                    ) : selectedMembers.map(u => {
                                        const limit = userQuotas.get(u.id)
                                        return (
                                            <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 px-3 py-2">
                                                <div className="flex items-center gap-2 min-w-[180px]">
                                                    {u.image ? (
                                                        <img src={u.image} className="h-8 w-8 rounded-full object-cover" alt="" />
                                                    ) : (
                                                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                            {u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "?"}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-medium truncate">{u.name || u.email || "未知用戶"}</span>
                                                        {u.email && <span className="text-[11px] text-muted-foreground truncate">{u.email}</span>}
                                                    </div>
                                                </div>
                                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <input
                                                        type="checkbox"
                                                        checked={limit === null}
                                                        onChange={e => setUserQuotaValue(u.id, e.target.checked ? null : (limit || 0))}
                                                    />
                                                    無上限
                                                </label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={limit === null || Number.isNaN(limit) ? "" : limit}
                                                    onChange={e => setUserQuotaValue(u.id, e.target.value === "" ? null : Number(e.target.value))}
                                                    disabled={limit === null}
                                                    className="w-32 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                    placeholder="Token 上限"
                                                />
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-border/60 bg-background/60 p-5 shadow-sm space-y-3">
                                <h4 className="text-sm font-semibold">群組模型總額度</h4>
                                <p className="text-xs text-muted-foreground">僅顯示已勾選的模型；為空表示無上限。</p>
                                <div className="space-y-2">
                                    {availableModels.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">尚無模型</p>
                                    ) : availableModels.map(model => {
                                        const quota = groupModelQuotas.find(q => q.model === model)?.limitTokens ?? null
                                        return (
                                            <div key={model} className="flex items-center gap-3 rounded-xl border border-border/50 px-3 py-2">
                                                <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{model}</span>
                                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <input
                                                        type="checkbox"
                                                        checked={quota === null}
                                                        onChange={e => setGroupModelQuotas(prev => {
                                                            const filtered = prev.filter(q => q.model !== model)
                                                            return [...filtered, { model, limitTokens: e.target.checked ? null : 0 }]
                                                        })}
                                                    />
                                                    無上限
                                                </label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={quota === null || Number.isNaN(quota) ? "" : quota}
                                                    onChange={e => setGroupModelQuotas(prev => {
                                                        const filtered = prev.filter(q => q.model !== model)
                                                        return [...filtered, { model, limitTokens: e.target.value === "" ? null : Number(e.target.value) }]
                                                    })}
                                                    disabled={quota === null}
                                                    className="w-32 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                    placeholder="Token 上限"
                                                />
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border/60 bg-background/60 p-5 shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-semibold">模型額度（依用戶）</h4>
                                    <p className="text-xs text-muted-foreground">限制特定用戶在特定模型的用量</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 items-end">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground">用戶</span>
                                    <select
                                        value={newQuotaUser}
                                        onChange={e => setNewQuotaUser(e.target.value)}
                                        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                                    >
                                        <option value="">選擇用戶</option>
                                        {selectedMembers.map(u => (
                                            <option key={u.id} value={u.id}>{u.name || u.email}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground">模型</span>
                                    <select
                                        value={newQuotaModel}
                                        onChange={e => setNewQuotaModel(e.target.value)}
                                        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                                    >
                                        <option value="">選擇模型</option>
                                        {availableModels.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <input
                                            type="checkbox"
                                            checked={newQuotaUnlimited}
                                            onChange={e => setNewQuotaUnlimited(e.target.checked)}
                                        />
                                        無上限
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={newQuotaUnlimited ? "" : newQuotaLimit}
                                        onChange={e => setNewQuotaLimit(e.target.value)}
                                        disabled={newQuotaUnlimited}
                                        className="w-32 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                        placeholder="Token 上限"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        const limit = newQuotaUnlimited || newQuotaLimit === "" ? null : Number(newQuotaLimit)
                                        addModelQuota(newQuotaUser, newQuotaModel, limit)
                                        setNewQuotaLimit("")
                                        setNewQuotaUnlimited(false)
                                    }}
                                    className="px-3 py-1.5 rounded-md border border-border text-xs hover:bg-muted transition-colors"
                                    disabled={!newQuotaUser || !newQuotaModel}
                                >
                                    新增/更新
                                </button>
                            </div>
                            {modelQuotas.length > 0 ? (
                                <div className="divide-y divide-border/60">
                                    {modelQuotas.map((q, idx) => {
                                        const user = allUsers.find(u => u.id === q.userId)
                                        return (
                                            <div key={`${q.userId}-${q.model}-${idx}`} className="flex items-center justify-between py-2 text-sm">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-medium truncate">{user?.name || user?.email || q.userId}</span>
                                                        {user?.email && <span className="text-xs text-muted-foreground truncate">{user.email}</span>}
                                                    </div>
                                                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted">{q.model}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-muted-foreground">
                                                        {q.limitTokens === null ? "無上限" : q.limitTokens.toLocaleString()}
                                                    </span>
                                                    <button
                                                        onClick={() => removeModelQuota(idx)}
                                                        className="text-xs text-destructive hover:underline"
                                                    >
                                                        移除
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">尚未設定模型額度</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Main GroupsPanel ─────────────────────────────────────────────────────────
export function GroupsPanel({ allUsers, viewerRole }: { allUsers: User[], viewerRole: string }) {
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
    const [creatingName, setCreatingName] = useState("")
    const [creating, setCreating] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState("")
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const isAdminViewer = ["admin", "super"].includes(viewerRole)

    const canEditGroup = useCallback(
        (g: Group) => isAdminViewer || ["creator", "editor"].includes(g.currentUserRole || ""),
        [isAdminViewer]
    )
    const canDeleteGroup = useCallback(
        (g: Group) => isAdminViewer || g.currentUserRole === "creator",
        [isAdminViewer]
    )

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
        const target = groups.find(g => g.id === id)
        if (!target || !canEditGroup(target)) {
            toast.error("沒有權限更名此群組")
            return
        }
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
        if (!g || !canDeleteGroup(g)) {
            toast.error("沒有權限刪除此群組")
            return
        }
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
                                <div className="flex items-center gap-2 shrink-0">
                                    {g.currentUserRole && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                            {g.currentUserRole === "creator" ? "Creator" : g.currentUserRole === "editor" ? "共編者" : "成員"}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">{g.memberCount}人</span>
                                </div>
                                {editingId === g.id ? (
                                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => renameGroup(g.id)} className="text-primary"><Check className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => setEditingId(null)} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                                    </div>
                                ) : (
                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => { if (!canEditGroup(g)) return; setEditingId(g.id); setEditingName(g.name) }}
                                            className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-40"
                                            disabled={!canEditGroup(g)}
                                        ><Pencil className="h-3 w-3" /></button>
                                        <button
                                            onClick={() => deleteGroup(g.id)}
                                            disabled={deletingId === g.id || !canDeleteGroup(g)}
                                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-40"
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
                            viewerRole={viewerRole}
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
