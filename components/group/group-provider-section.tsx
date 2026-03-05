"use client"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Plus, Trash2, RefreshCw, Pencil, Check, X, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react"
import { GroupProvider, maskKey, UNIEAI_PROVIDER_URL, UNIEAI_PROVIDER_KEY } from "./group-types"
import { UnieAIIcon } from "@/components/sidebar/unieai-logo"

function ModelChecklist({ groupId, provider, onSaved, readOnly = false }: {
    groupId: string; provider: GroupProvider; onSaved: () => void; readOnly?: boolean
}) {
    const allModels = Array.isArray(provider.modelList) ? provider.modelList : []
    const [selected, setSelected] = useState<Set<string>>(new Set(Array.isArray(provider.selectedModels) ? provider.selectedModels : []))
    const [saving, setSaving] = useState(false)
    useEffect(() => { setSelected(new Set(Array.isArray(provider.selectedModels) ? provider.selectedModels : [])) }, [provider.selectedModels])
    const toggleAll = () => { if (readOnly) return; selected.size === allModels.length ? setSelected(new Set()) : setSelected(new Set(allModels.map((m: any) => m.id || String(m)))) }
    const toggle = (id: string) => { if (readOnly) return; setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
    const save = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/admin/groups/${groupId}/providers/${provider.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selectedModels: [...selected] }) })
            if (!res.ok) { toast.error("儲存失敗"); return }
            toast.success("模型選擇已儲存"); onSaved()
        } finally { setSaving(false) }
    }
    if (allModels.length === 0) return <p className="text-xs text-muted-foreground py-2 px-1">尚無模型資料，請點擊「重新整理」獲取模型清單</p>
    const allChecked = selected.size === allModels.length; const someChecked = selected.size > 0 && selected.size < allModels.length
    return (
        <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                    <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked }} onChange={toggleAll} className="h-3.5 w-3.5 rounded border-border accent-primary" disabled={readOnly} />
                    全選 ({selected.size}/{allModels.length})
                </label>
                <button onClick={save} disabled={saving || readOnly} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    <Check className="h-3 w-3" />{saving ? "儲存中..." : readOnly ? "僅檢視" : "套用"}
                </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                {allModels.map((m: any) => {
                    const id = m.id || String(m); return (
                        <label key={id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs">
                            <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} className="h-3.5 w-3.5 rounded border-border accent-primary shrink-0" disabled={readOnly} />
                            <span className="font-mono truncate">{id}</span>
                        </label>
                    )
                })}
            </div>
        </div>
    )
}

function ProviderForm({ groupId, provider, onSave, onCancel }: {
    groupId: string; provider?: GroupProvider; onSave: (created?: GroupProvider) => void; onCancel: () => void
}) {
    const [form, setForm] = useState({ displayName: provider?.displayName || "", prefix: provider?.prefix || "", apiUrl: provider?.apiUrl || "", apiKey: provider?.apiKey || "", enable: provider ? provider.enable === 1 : true })
    const [showApiKey, setShowApiKey] = useState(false)
    const [saving, setSaving] = useState(false)
    const applyDefaults = () => {
        if (!UNIEAI_PROVIDER_URL) { toast.error("NEXT_PUBLIC_UNIEAI_PROVIDER_URL 未設定"); return }
        if (!UNIEAI_PROVIDER_KEY) { toast.error("NEXT_PUBLIC_UNIEAI_PROVIDER_KEY 未設定"); return }
        setForm(f => ({ ...f, apiUrl: UNIEAI_PROVIDER_URL, apiKey: UNIEAI_PROVIDER_KEY }))
    }
    const save = async () => {
        setSaving(true)
        try {
            const url = provider ? `/api/admin/groups/${groupId}/providers/${provider.id}` : `/api/admin/groups/${groupId}/providers`
            const res = await fetch(url, { method: provider ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
            if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "儲存失敗"); return }
            const data = await res.json(); toast.success(provider ? "更新完成" : `新增完成${data.modelList?.length > 0 ? `，已自動獲取 ${data.modelList.length} 個模型` : ""}`); onSave(data)
        } finally { setSaving(false) }
    }
    return (
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">顯示名稱</label><input className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="e.g. OpenAI" /></div>
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Prefix <span className="text-muted-foreground/60">(4碼英數)</span></label><input className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50" value={form.prefix} onChange={e => setForm(f => ({ ...f, prefix: e.target.value.toUpperCase().slice(0, 4) }))} placeholder="GRPA" disabled={!!provider} maxLength={4} /></div>
            </div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1">API URL</label>
                <div className="flex items-center gap-2">
                    <input className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring" value={form.apiUrl} onChange={e => setForm(f => ({ ...f, apiUrl: e.target.value }))} placeholder="https://api.openai.com" />
                    <button type="button" onClick={applyDefaults} className="h-9 w-9 shrink-0 rounded-full border border-input bg-background hover:bg-muted transition-colors inline-flex items-center justify-center" title="Use UnieAI"><UnieAIIcon className="h-4 w-4" /></button>
                </div>
            </div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1">API Key</label>
                <div className="flex items-center gap-2">
                    <input className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring" type={showApiKey ? "text" : "password"} value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} placeholder="sk-..." />
                    <button type="button" onClick={() => setShowApiKey(v => !v)} className="h-9 w-9 shrink-0 rounded-full border border-input bg-background hover:bg-muted transition-colors inline-flex items-center justify-center" title={showApiKey ? "Hide API Key" : "Show API Key"} aria-label={showApiKey ? "Hide API Key" : "Show API Key"}>
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
            </div>
            <div className="flex items-center gap-2"><input id={`enable-${provider?.id || "new"}`} type="checkbox" checked={form.enable} onChange={e => setForm(f => ({ ...f, enable: e.target.checked }))} className="h-4 w-4 rounded border-border accent-primary" /><label htmlFor={`enable-${provider?.id || "new"}`} className="text-sm">啟用</label></div>
            <div className="flex gap-2 pt-1">
                <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"><Check className="h-3.5 w-3.5" />{saving ? (provider ? "儲存中..." : "建立並獲取模型...") : (provider ? "儲存" : "建立")}</button>
                <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors"><X className="h-3.5 w-3.5" />取消</button>
            </div>
        </div>
    )
}

function ProviderRow({ groupId, provider, onRefresh, canEdit }: {
    groupId: string; provider: GroupProvider; onRefresh: () => void; canEdit: boolean
}) {
    const [editing, setEditing] = useState(false)
    const [showModels, setShowModels] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const syncModels = async () => {
        if (!canEdit) return; setSyncing(true)
        try {
            const res = await fetch(`/api/admin/groups/${groupId}/providers/${provider.id}/sync`, { method: "POST" })
            if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "同步失敗"); return }
            const data = await res.json(); toast.success(`已更新 ${data.modelList?.length ?? 0} 個模型`); onRefresh(); setShowModels(true)
        } finally { setSyncing(false) }
    }
    const deleteProvider = async () => {
        if (!canEdit) return
        if (!confirm(`確定要刪除 Provider「${provider.displayName || provider.prefix}」？`)) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/groups/${groupId}/providers/${provider.id}`, { method: "DELETE" })
            if (!res.ok) { toast.error("刪除失敗"); return }; toast.success("已刪除"); onRefresh()
        } finally { setDeleting(false) }
    }
    if (editing) return <ProviderForm groupId={groupId} provider={provider} onSave={() => { setEditing(false); onRefresh() }} onCancel={() => setEditing(false)} />
    const modelCount = Array.isArray(provider.modelList) ? provider.modelList.length : 0
    const selectedCount = Array.isArray(provider.selectedModels) ? provider.selectedModels.length : 0
    return (
        <div className="rounded-lg border border-border/40 bg-background overflow-hidden">
            <div className="flex items-center gap-2 py-2 px-3 text-sm">
                <div className={`h-2 w-2 rounded-full shrink-0 ${provider.enable ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">{provider.prefix}</span>
                <span className="font-medium flex-1 truncate">{provider.displayName || provider.prefix}</span>
                <button onClick={() => setShowModels(v => !v)} className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 flex items-center gap-1">
                    {modelCount > 0 ? `${selectedCount > 0 ? selectedCount : "全部"} / ${modelCount} 模型` : "無模型"}
                    {showModels ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                <span className="text-xs text-muted-foreground/60 truncate max-w-[120px] hidden lg:block">{maskKey(provider.apiKey)}</span>
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={syncModels} disabled={syncing || !canEdit} title="重新整理模型清單" className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /></button>
                    <button onClick={() => canEdit && setEditing(true)} title="編輯" className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50" disabled={!canEdit}><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={deleteProvider} disabled={deleting || !canEdit} title="刪除" className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
            </div>
            {showModels && <div className="border-t border-border/30 px-3 pb-3"><ModelChecklist groupId={groupId} provider={provider} onSaved={onRefresh} readOnly={!canEdit} /></div>}
        </div>
    )
}

export function ProviderSection({ groupId, canEdit, onProviderCountChange }: { groupId: string; canEdit: boolean; onProviderCountChange?: (count: number) => void }) {
    const [providers, setProviders] = useState<GroupProvider[]>([])
    const [addingProvider, setAddingProvider] = useState(false)
    const fetchProviders = async () => {
        const res = await fetch(`/api/admin/groups/${groupId}/providers`)
        if (res.ok) { const data = await res.json(); setProviders(data); onProviderCountChange?.(data.length) }
    }
    useEffect(() => { fetchProviders() }, [groupId])
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">設定此群組可用的 AI Provider，並勾選要開放的模型</p>
                {canEdit && <button onClick={() => setAddingProvider(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors"><Plus className="h-3.5 w-3.5" />新增 Provider</button>}
            </div>
            {addingProvider && canEdit && <ProviderForm groupId={groupId} onSave={(created) => { setAddingProvider(false); fetchProviders(); if ((created?.modelList?.length ?? 0) > 0) toast.success(`已獲取 ${created!.modelList.length} 個模型`) }} onCancel={() => setAddingProvider(false)} />}
            {providers.length === 0 && !addingProvider ? <p className="text-sm text-muted-foreground text-center py-6">尚未設定任何 Provider</p>
                : <div className="space-y-2">{providers.map(p => <ProviderRow key={p.id} groupId={groupId} provider={p} onRefresh={fetchProviders} canEdit={canEdit} />)}</div>}
            {!canEdit && <p className="text-xs text-muted-foreground text-right">只有 Creator/共編者可以調整 Provider</p>}
        </div>
    )
}
