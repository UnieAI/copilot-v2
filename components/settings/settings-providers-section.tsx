"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus, Trash2, RefreshCw, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, X } from "lucide-react"

type ModelItem = {
    id: string
    object?: string
    [key: string]: any
}

type Provider = {
    id: string
    userId: string
    enable: number
    displayName: string
    prefix: string
    apiUrl: string
    apiKey: string
    modelList: ModelItem[]
    updatedAt: string
}

type ProviderFormState = {
    displayName: string
    prefix: string
    apiUrl: string
    apiKey: string
    enable: boolean
}

function ModelBadge({ model, onRemove }: { model: ModelItem; onRemove: () => void }) {
    return (
        <div className="group relative flex items-center gap-1 bg-muted border border-border px-2.5 py-1 rounded-full text-xs hover:border-destructive/50 transition-colors">
            <span className="truncate max-w-[180px]">{model.id || String(model)}</span>
            <button
                onClick={onRemove}
                className="opacity-0 group-hover:opacity-100 transition-opacity -mr-0.5 ml-0.5 p-0.5 rounded-full hover:bg-destructive/15 hover:text-destructive text-muted-foreground"
                title="移除此模型"
                type="button"
            >
                <X className="h-3 w-3" />
            </button>
        </div>
    )
}

function ProviderCard({
    provider,
    existingPrefixes,
    onUpdate,
    onDelete,
}: {
    provider: Provider
    existingPrefixes: string[]
    onUpdate: (updated: Provider) => void
    onDelete: () => void
}) {
    const [expanded, setExpanded] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState<ProviderFormState>({
        displayName: provider.displayName,
        prefix: provider.prefix,
        apiUrl: provider.apiUrl,
        apiKey: provider.apiKey,
        enable: provider.enable === 1,
    })
    const [prefixError, setPrefixError] = useState("")
    const [models, setModels] = useState<ModelItem[]>(
        Array.isArray(provider.modelList) ? provider.modelList : []
    )

    const validatePrefix = (val: string) => {
        if (!val) return "Prefix 為必填"
        if (!/^[a-zA-Z0-9]{4}$/.test(val)) return "Prefix 需為4碼英文或數字"
        const otherPrefixes = existingPrefixes.filter(p => p !== provider.prefix)
        if (otherPrefixes.includes(val.toUpperCase())) return "Prefix 已被其他 Provider 使用"
        return ""
    }

    const handlePrefixChange = (val: string) => {
        setForm(prev => ({ ...prev, prefix: val }))
        setPrefixError(validatePrefix(val))
    }

    const handleToggleEnable = async () => {
        const newEnable = !form.enable
        setForm(prev => ({ ...prev, enable: newEnable }))
        try {
            const res = await fetch(`/api/user/providers/${provider.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enable: newEnable }),
            })
            if (!res.ok) throw new Error()
            const updated = await res.json()
            onUpdate({ ...updated, modelList: models })
            toast.success(newEnable ? "Provider 已啟用" : "Provider 已停用")
        } catch {
            setForm(prev => ({ ...prev, enable: !newEnable }))
            toast.error("操作失敗")
        }
    }

    const handleSave = async () => {
        const err = validatePrefix(form.prefix)
        if (err) { setPrefixError(err); return }

        setSaving(true)
        try {
            const res = await fetch(`/api/user/providers/${provider.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    displayName: form.displayName,
                    prefix: form.prefix,
                    apiUrl: form.apiUrl,
                    apiKey: form.apiKey,
                }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || "儲存失敗")
            }
            const updated = await res.json()
            onUpdate({ ...updated, modelList: models })
            toast.success("Provider 已儲存")
        } catch (e: any) {
            toast.error(e.message || "儲存失敗")
        } finally {
            setSaving(false)
        }
    }

    const handleSync = async () => {
        // Save URL/Key first if needed
        const err = validatePrefix(form.prefix)
        if (err) { setPrefixError(err); return }

        setSyncing(true)
        try {
            // Patch URL/key before syncing
            await fetch(`/api/user/providers/${provider.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apiUrl: form.apiUrl, apiKey: form.apiKey }),
            })
            const res = await fetch(`/api/user/providers/${provider.id}/sync`, { method: "POST" })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || "同步失敗")
            }
            const data = await res.json()
            const newModels = Array.isArray(data.modelList) ? data.modelList : []
            setModels(newModels)
            onUpdate({ ...provider, ...data.provider, modelList: newModels })
            toast.success(`已同步 ${newModels.length} 個模型`)
            setExpanded(true)
        } catch (e: any) {
            toast.error(e.message || "同步失敗")
        } finally {
            setSyncing(false)
        }
    }

    const handleRemoveModel = async (modelId: string) => {
        try {
            const res = await fetch(`/api/user/providers/${provider.id}/models`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ modelId }),
            })
            if (!res.ok) throw new Error()
            const data = await res.json()
            const newModels = Array.isArray(data.modelList) ? data.modelList : []
            setModels(newModels)
            onUpdate({ ...provider, modelList: newModels })
        } catch {
            toast.error("移除失敗")
        }
    }

    const handleDelete = async () => {
        if (!confirm(`確定要刪除 Provider「${form.displayName || form.prefix}」嗎？`)) return
        try {
            await fetch(`/api/user/providers/${provider.id}`, { method: "DELETE" })
            onDelete()
            toast.success("Provider 已刪除")
        } catch {
            toast.error("刪除失敗")
        }
    }

    return (
        <div className={`rounded-2xl border transition-colors ${form.enable ? 'border-border bg-background' : 'border-border/50 bg-muted/30'}`}>
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3">
                <button
                    type="button"
                    onClick={handleToggleEnable}
                    className={`shrink-0 transition-colors ${form.enable ? 'text-primary' : 'text-muted-foreground/50'}`}
                    title={form.enable ? "點擊停用" : "點擊啟用"}
                >
                    {form.enable ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{form.displayName || '未命名 Provider'}</span>
                        <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold tracking-wider shrink-0">{form.prefix}</span>
                        {!form.enable && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">已停用</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{form.apiUrl || '未設定 URL'} · {models.length} 個模型</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? '同步中...' : '同步模型'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setExpanded(v => !v)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                    >
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                        title="刪除 Provider"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Expanded edit form */}
            {expanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-border/40 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Display Name */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium">顯示名稱</label>
                            <input
                                type="text"
                                value={form.displayName}
                                onChange={e => setForm(prev => ({ ...prev, displayName: e.target.value }))}
                                placeholder="例：OpenAI GPT-4"
                                className="w-full h-9 rounded-xl border border-input/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                            />
                        </div>

                        {/* Prefix */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium">Prefix（4碼英數字，唯一識別）{' '}<span className="text-destructive">*</span></label>
                            <input
                                type="text"
                                value={form.prefix}
                                disabled={true} // 不可更動
                                // onChange={e => handlePrefixChange(e.target.value)}
                                placeholder="例：OAI1"
                                maxLength={4}
                                className={`w-full h-9 rounded-xl border bg-background px-3 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${prefixError ? 'border-destructive focus:border-destructive' : 'border-input/60 focus:border-primary/50'}`}
                            />
                            {prefixError && <p className="text-xs text-destructive">{prefixError}</p>}
                        </div>

                        {/* API URL */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium">API URL</label>
                            <input
                                type="url"
                                value={form.apiUrl}
                                onChange={e => setForm(prev => ({ ...prev, apiUrl: e.target.value }))}
                                placeholder="https://api.openai.com/v1"
                                className="w-full h-9 rounded-xl border border-input/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                            />
                        </div>

                        {/* API Key */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium">API Key</label>
                            <input
                                type="password"
                                value={form.apiKey}
                                onChange={e => setForm(prev => ({ ...prev, apiKey: e.target.value }))}
                                placeholder="sk-..."
                                className="w-full h-9 rounded-xl border border-input/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !!prefixError}
                            className="h-9 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        >
                            {saving ? '儲存中...' : '儲存設定'}
                        </button>
                    </div>

                    {/* Model List */}
                    {models.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-border/40">
                            <p className="text-xs font-medium text-muted-foreground">已同步模型（{models.length}）· 懸停可移除</p>
                            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                                {models.map((m: ModelItem) => (
                                    <ModelBadge
                                        key={m.id || String(m)}
                                        model={m}
                                        onRemove={() => handleRemoveModel(m.id || String(m))}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    {models.length === 0 && (
                        <p className="text-xs text-muted-foreground pt-2 border-t border-border/40">尚未同步模型，請點擊「同步模型」</p>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Create Provider Dialog ────────────────────────────────────────────────
function CreateProviderDialog({
    existingPrefixes,
    onCreated,
    onClose,
}: {
    existingPrefixes: string[]
    onCreated: (provider: Provider) => void
    onClose: () => void
}) {
    const [form, setForm] = useState({
        displayName: '',
        prefix: '',
        apiUrl: '',
        apiKey: '',
    })
    const [prefixError, setPrefixError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const validatePrefix = (val: string) => {
        if (!val) return 'Prefix 為必填'
        if (!/^[a-zA-Z0-9]{4}$/.test(val)) return 'Prefix 需為4碼英文或數字'
        if (existingPrefixes.includes(val.toUpperCase())) return 'Prefix 已被其他 Provider 使用'
        return ''
    }

    const handlePrefixChange = (val: string) => {
        const upper = val.toUpperCase()
        setForm(prev => ({ ...prev, prefix: upper }))
        setPrefixError(validatePrefix(upper))
    }

    const handleSubmit = async () => {
        const err = validatePrefix(form.prefix)
        if (err) { setPrefixError(err); return }
        if (!form.displayName.trim()) { toast.error('請輸入顯示名稱'); return }

        setSubmitting(true)
        try {
            const res = await fetch('/api/user/providers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName: form.displayName.trim(),
                    prefix: form.prefix,
                    apiUrl: form.apiUrl.trim(),
                    apiKey: form.apiKey.trim(),
                    enable: true,
                }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || '建立失敗')
            }
            const newProvider = await res.json()
            onCreated({ ...newProvider, modelList: [] })
            toast.success('Provider 已建立')
            onClose()
        } catch (e: any) {
            toast.error(e.message || '建立失敗')
        } finally {
            setSubmitting(false)
        }
    }

    // Close on backdrop click
    const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose()
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleBackdrop}
        >
            <div className="w-full max-w-md mx-4 bg-background rounded-2xl border border-border shadow-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
                    <h3 className="font-semibold text-base">新增 Provider</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Form */}
                <div className="px-6 py-5 space-y-4">
                    {/* Display Name */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">
                            顯示名稱 <span className="text-destructive">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.displayName}
                            onChange={e => setForm(prev => ({ ...prev, displayName: e.target.value }))}
                            placeholder="例：OpenAI、My Local LLM"
                            autoFocus
                            className="w-full h-10 rounded-xl border border-input/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        />
                    </div>

                    {/* Prefix */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">
                            Prefix <span className="text-destructive">*</span>
                            <span className="ml-1.5 text-xs text-muted-foreground font-normal">（4碼英文或數字，唯一識別）</span>
                        </label>
                        <input
                            type="text"
                            value={form.prefix}
                            onChange={e => handlePrefixChange(e.target.value)}
                            placeholder="例：OAI1"
                            maxLength={4}
                            className={`w-full h-10 rounded-xl border bg-background px-4 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${prefixError ? 'border-destructive focus:border-destructive' : 'border-input/60 focus:border-primary/50'
                                }`}
                        />
                        {prefixError && <p className="text-xs text-destructive">{prefixError}</p>}
                    </div>

                    {/* API URL */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">
                            API URL
                            <span className="ml-1.5 text-xs text-muted-foreground font-normal">（可之後再填）</span>
                        </label>
                        <input
                            type="text"
                            value={form.apiUrl}
                            onChange={e => setForm(prev => ({ ...prev, apiUrl: e.target.value }))}
                            placeholder="https://api.openai.com/v1"
                            className="w-full h-10 rounded-xl border border-input/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        />
                    </div>

                    {/* API Key */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">
                            API Key
                            <span className="ml-1.5 text-xs text-muted-foreground font-normal">（可之後再填）</span>
                        </label>
                        <input
                            type="password"
                            value={form.apiKey}
                            onChange={e => setForm(prev => ({ ...prev, apiKey: e.target.value }))}
                            placeholder="sk-..."
                            className="w-full h-10 rounded-xl border border-input/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-9 px-4 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || !!prefixError}
                        className="h-9 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                        {submitting ? '建立中...' : '建立 Provider'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export function SettingsProvidersSection({ initialProviders }: { initialProviders: Provider[] }) {
    const [providers, setProviders] = useState<Provider[]>(initialProviders)
    const [showCreateDialog, setShowCreateDialog] = useState(false)

    const existingPrefixes = providers.map(p => p.prefix)

    const handleUpdate = (updated: Provider) => {
        setProviders(prev => prev.map(p => p.id === updated.id ? updated : p))
    }

    const handleDelete = (id: string) => {
        setProviders(prev => prev.filter(p => p.id !== id))
    }

    return (
        <>
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="font-semibold">API Provider 設定</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">新增多個 OpenAI 相容 API Provider，每個 Provider 可有獨立模型列表</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowCreateDialog(true)}
                        className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-95"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        新增 Provider
                    </button>
                </div>

                {providers.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-border rounded-2xl text-muted-foreground">
                        <p className="text-sm">尚未設定任何 Provider</p>
                        <p className="text-xs mt-1">點擊「新增 Provider」開始設定</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {providers.map(p => (
                            <ProviderCard
                                key={p.id}
                                provider={p}
                                existingPrefixes={existingPrefixes.filter(px => px !== p.prefix)}
                                onUpdate={handleUpdate}
                                onDelete={() => handleDelete(p.id)}
                            />
                        ))}
                    </div>
                )}
            </section>

            {showCreateDialog && (
                <CreateProviderDialog
                    existingPrefixes={existingPrefixes}
                    onCreated={newProvider => setProviders(prev => [...prev, newProvider])}
                    onClose={() => setShowCreateDialog(false)}
                />
            )}
        </>
    )
}
