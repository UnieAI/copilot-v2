"use client"
import { useState, useCallback, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { UsageRow, UsagePoint, UsageByModelRow, UserQuota, ModelQuota, GroupModelQuota, quotaHintText, Group, User } from "./group-types"

function UserAvatar({ user }: { user: { name?: string | null; email?: string | null; image?: string | null } }) {
    if (user.image) return <img src={user.image} className="h-7 w-7 rounded-full object-cover" alt="" />
    return <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">{user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?"}</div>
}

export function UsageSection({ group }: { group: Group }) {
    const [usage, setUsage] = useState<UsageRow[]>([])
    const [usageSeries, setUsageSeries] = useState<UsagePoint[]>([])
    const [usageByModel, setUsageByModel] = useState<UsageByModelRow[]>([])
    const [usageLoading, setUsageLoading] = useState(false)
    const [rangeStart, setRangeStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })
    const [rangeEnd, setRangeEnd] = useState(() => new Date().toISOString().slice(0, 10))

    const fetchUsage = useCallback(async () => {
        setUsageLoading(true)
        try {
            const params = new URLSearchParams()
            if (rangeStart) params.set("start", rangeStart)
            if (rangeEnd) params.set("end", rangeEnd)
            const res = await fetch(`/api/admin/groups/${group.id}/usage?${params}`)
            if (!res.ok) return
            const data = await res.json()
            setUsage(data.perUser || []); setUsageByModel(data.perUserModel || []); setUsageSeries(data.timeseries || [])
        } finally { setUsageLoading(false) }
    }, [group.id, rangeStart, rangeEnd])

    useEffect(() => { fetchUsage() }, [fetchUsage])

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">依用戶彙總的 token 使用量</p>
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">起</span>
                    <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                    <span className="text-muted-foreground">迄</span>
                    <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                    <button onClick={fetchUsage} className="px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors" disabled={usageLoading}>{usageLoading ? "載入中..." : "套用"}</button>
                </div>
            </div>
            {usageSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{usageLoading ? "載入中..." : "尚無用量紀錄"}</p>
            ) : (
                <ChartContainer className="w-full h-64" config={{ total: { label: "Total", color: "hsl(var(--primary))" }, prompt: { label: "Prompt", color: "hsl(var(--muted-foreground))" }, completion: { label: "Completion", color: "hsl(var(--secondary))" } }}>
                    <AreaChart data={usageSeries}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={v => v?.slice(5)} tick={{ fontSize: 12 }} minTickGap={12} />
                        <ChartTooltip content={<ChartTooltipContent labelFormatter={v => v} />} />
                        <Area type="monotone" dataKey="totalTokens" stroke="var(--color-total)" fill="var(--color-total)" fillOpacity={0.15} strokeWidth={2} name="total" />
                        <Area type="monotone" dataKey="promptTokens" stroke="var(--color-prompt)" fill="var(--color-prompt)" fillOpacity={0.12} strokeWidth={1.5} name="prompt" />
                        <Area type="monotone" dataKey="completionTokens" stroke="var(--color-completion)" fill="var(--color-completion)" fillOpacity={0.12} strokeWidth={1.5} name="completion" />
                    </AreaChart>
                </ChartContainer>
            )}
            {usage.length > 0 && (
                <div className="rounded-xl border border-border/60 overflow-hidden">
                    <div className="grid grid-cols-4 gap-2 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground"><span>用戶</span><span className="text-right">Prompt</span><span className="text-right">Completion</span><span className="text-right">Total</span></div>
                    <div className="divide-y divide-border/60">{usage.map(u => (
                        <div key={u.user.id} className="grid grid-cols-4 gap-2 px-3 py-2 text-sm items-center">
                            <div className="flex items-center gap-2 min-w-0"><UserAvatar user={u.user} /><div className="flex flex-col min-w-0"><span className="text-sm font-medium truncate">{u.user.name || u.user.email || "未知用戶"}</span>{u.user.email && <span className="text-xs text-muted-foreground truncate">{u.user.email}</span>}</div></div>
                            <span className="text-right font-mono text-xs">{u.promptTokens?.toLocaleString?.()}</span>
                            <span className="text-right font-mono text-xs">{u.completionTokens?.toLocaleString?.()}</span>
                            <span className="text-right font-mono text-xs font-semibold">{u.totalTokens?.toLocaleString?.()}</span>
                        </div>
                    ))}</div>
                </div>
            )}
        </div>
    )
}

export function QuotaSection({ group, members }: { group: Group; members: User[] }) {
    const [userQuotas, setUserQuotas] = useState<Map<string, UserQuota>>(new Map())
    const [modelQuotas, setModelQuotas] = useState<ModelQuota[]>([])
    const [groupModelQuotas, setGroupModelQuotas] = useState<GroupModelQuota[]>([])
    const [providers, setProviders] = useState<Array<{ selectedModels: string[]; modelList: any[] }>>([])
    const [savingQuotas, setSavingQuotas] = useState(false)
    const [newQuotaUser, setNewQuotaUser] = useState("")
    const [newQuotaModel, setNewQuotaModel] = useState("")
    const [newQuotaLimit, setNewQuotaLimit] = useState("")
    const [newQuotaUnlimited, setNewQuotaUnlimited] = useState(false)
    const [newQuotaRefill, setNewQuotaRefill] = useState("12")

    useEffect(() => {
        fetch(`/api/admin/groups/${group.id}/quotas`).then(r => r.ok ? r.json() : null).then(data => {
            if (!data) return
            const m = new Map<string, UserQuota>()
            data.userQuotas?.forEach((q: any) => m.set(q.userId, { userId: q.userId, limitTokens: q.limitTokens === null ? null : Number(q.limitTokens), refillIntervalHours: Number(q.refillIntervalHours ?? 12), usedTokens: Number(q.usedTokens ?? 0), remainingTokens: q.remainingTokens === null ? null : Number(q.remainingTokens ?? 0), refreshAt: q.refreshAt }))
            setUserQuotas(m)
            setModelQuotas(data.modelQuotas?.map((q: any) => ({ userId: q.userId, model: q.model, limitTokens: q.limitTokens === null ? null : Number(q.limitTokens), refillIntervalHours: Number(q.refillIntervalHours ?? 12), usedTokens: Number(q.usedTokens ?? 0), remainingTokens: q.remainingTokens === null ? null : Number(q.remainingTokens ?? 0), refreshAt: q.refreshAt })) ?? [])
            setGroupModelQuotas(data.groupModelQuotas?.map((q: any) => ({ model: q.model, limitTokens: q.limitTokens === null ? null : Number(q.limitTokens), refillIntervalHours: Number(q.refillIntervalHours ?? 12), usedTokens: Number(q.usedTokens ?? 0), remainingTokens: q.remainingTokens === null ? null : Number(q.remainingTokens ?? 0), refreshAt: q.refreshAt })) ?? [])
        })
        fetch(`/api/admin/groups/${group.id}/providers`).then(r => r.ok ? r.json() : []).then(setProviders)
    }, [group.id])

    const availableModels = useMemo(() => {
        const s = new Set<string>()
        providers.forEach(p => { const sel = Array.isArray(p.selectedModels) ? p.selectedModels : []; const all = Array.isArray(p.modelList) ? p.modelList : []; if (sel.length === 0) return; all.forEach((m: any) => { const id = m.id || String(m); if (sel.includes(id)) s.add(id) }) })
        return Array.from(s)
    }, [providers])

    const setUQ = (userId: string, patch: Partial<UserQuota>) => setUserQuotas(prev => { const n = new Map(prev); const cur = n.get(userId) || { userId, limitTokens: null, refillIntervalHours: 12 }; n.set(userId, { ...cur, ...patch }); return n })

    const saveQuotas = async () => {
        setSavingQuotas(true)
        try {
            const body = {
                userQuotas: Array.from(userQuotas.entries()).map(([userId, q]) => ({ userId, limitTokens: q.limitTokens === null || Number.isNaN(Number(q.limitTokens)) ? null : Number(q.limitTokens), refillIntervalHours: Math.max(1, Number(q.refillIntervalHours || 12)) })),
                modelQuotas: modelQuotas.map(q => ({ userId: q.userId, model: q.model, limitTokens: q.limitTokens === null ? null : Number(q.limitTokens), refillIntervalHours: Math.max(1, Number(q.refillIntervalHours || 12)) })),
                groupModelQuotas: groupModelQuotas.map(q => ({ model: q.model, limitTokens: q.limitTokens === null ? null : Number(q.limitTokens), refillIntervalHours: Math.max(1, Number(q.refillIntervalHours || 12)) })),
            }
            const res = await fetch(`/api/admin/groups/${group.id}/quotas`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
            if (!res.ok) { toast.error("儲存額度失敗"); return }
            toast.success("額度已更新")
        } finally { setSavingQuotas(false) }
    }

    return (
        <div className="space-y-4">
            {/* User quotas */}
            <div className="rounded-2xl border border-border/60 bg-background/60 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                    <div><h4 className="text-sm font-semibold">用戶總額度</h4><p className="text-xs text-muted-foreground mt-1">套用於此群組內所有模型</p></div>
                    <button onClick={saveQuotas} disabled={savingQuotas} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{savingQuotas ? "儲存中..." : "儲存"}</button>
                </div>
                {members.length === 0 ? <p className="text-xs text-muted-foreground">尚無成員。</p> : members.map(u => {
                    const quota = userQuotas.get(u.id) || { userId: u.id, limitTokens: null, refillIntervalHours: 12 }
                    return (
                        <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 px-3 py-2">
                            <div className="flex items-center gap-2 min-w-[180px]">{u.image ? <img src={u.image} className="h-8 w-8 rounded-full object-cover" alt="" /> : <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">{u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "?"}</div>}<div><p className="text-sm font-medium truncate">{u.name || u.email}</p>{u.email && <p className="text-[11px] text-muted-foreground">{u.email}</p>}</div></div>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={quota.limitTokens === null} onChange={e => setUQ(u.id, { limitTokens: e.target.checked ? null : 0 })} />無上限</label>
                            <input type="number" min={0} value={quota.limitTokens === null ? "" : quota.limitTokens} onChange={e => setUQ(u.id, { limitTokens: e.target.value === "" ? null : Number(e.target.value) })} disabled={quota.limitTokens === null} className="w-32 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Token 上限" />
                            <div className="flex items-center gap-1 text-xs"><span className="text-muted-foreground">刷新(小時)</span><input type="number" min={1} value={quota.refillIntervalHours || 12} onChange={e => setUQ(u.id, { refillIntervalHours: Math.max(1, Number(e.target.value || 12)) })} className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" /></div>
                            <span className="text-xs text-muted-foreground">{quotaHintText(quota)}</span>
                        </div>
                    )
                })}
            </div>
            {/* Per-model quota add row */}
            <div className="rounded-2xl border border-border/60 bg-background/60 p-5 shadow-sm space-y-3">
                <h4 className="text-sm font-semibold">模型額度（依用戶）</h4>
                <div className="flex flex-wrap gap-2 items-end">
                    <select value={newQuotaUser} onChange={e => setNewQuotaUser(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-sm"><option value="">選擇用戶</option>{members.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}</select>
                    <select value={newQuotaModel} onChange={e => setNewQuotaModel(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-sm"><option value="">選擇模型</option>{availableModels.map(m => <option key={m} value={m}>{m}</option>)}</select>
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={newQuotaUnlimited} onChange={e => setNewQuotaUnlimited(e.target.checked)} />無上限</label>
                    <input type="number" min={0} value={newQuotaUnlimited ? "" : newQuotaLimit} onChange={e => setNewQuotaLimit(e.target.value)} disabled={newQuotaUnlimited} className="w-32 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Token 上限" />
                    <div className="flex items-center gap-1 text-xs"><span className="text-muted-foreground">刷新(小時)</span><input type="number" min={1} value={newQuotaRefill} onChange={e => setNewQuotaRefill(e.target.value)} className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm" /></div>
                    <button onClick={() => { if (!newQuotaUser || !newQuotaModel) return; const lim = newQuotaUnlimited || newQuotaLimit === "" ? null : Number(newQuotaLimit); setModelQuotas(prev => { const f = prev.filter(q => !(q.userId === newQuotaUser && q.model === newQuotaModel)); return [...f, { userId: newQuotaUser, model: newQuotaModel, limitTokens: lim, refillIntervalHours: Math.max(1, Number(newQuotaRefill || 12)) }] }); setNewQuotaLimit(""); setNewQuotaUnlimited(false); setNewQuotaRefill("12") }} disabled={!newQuotaUser || !newQuotaModel} className="px-3 py-1.5 rounded-md border border-border text-xs hover:bg-muted transition-colors disabled:opacity-50">新增/更新</button>
                </div>
                {modelQuotas.length > 0 && <div className="divide-y divide-border/60">{modelQuotas.map((q, idx) => { const user = members.find(u => u.id === q.userId); return (<div key={`${q.userId}-${q.model}-${idx}`} className="flex items-center justify-between py-2 text-sm"><div className="flex items-center gap-3"><div><span className="font-medium">{user?.name || user?.email || q.userId}</span></div><span className="text-xs font-mono px-2 py-0.5 rounded bg-muted">{q.model}</span></div><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{quotaHintText(q)}</span><input type="number" min={1} value={q.refillIntervalHours || 12} onChange={e => setModelQuotas(prev => prev.map((item, i) => i === idx ? { ...item, refillIntervalHours: Math.max(1, Number(e.target.value || 12)) } : item))} className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm" /><button onClick={() => setModelQuotas(prev => prev.filter((_, i) => i !== idx))} className="text-xs text-destructive hover:underline">移除</button></div></div>) })}</div>}
            </div>
        </div>
    )
}
