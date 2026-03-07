"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { adminConfigActions } from "@/app/[locale]/(main)/admin/settings/actions"
import { toast } from "sonner"
import * as Tabs from "@radix-ui/react-tabs"
import { Sparkles, Globe, Eye, Zap, Save, RefreshCw, Paperclip, EyeOff } from "lucide-react"
import { UnieAIIcon } from "@/components/sidebar/unieai-logo"
import { Switch } from "@/components/ui/switch"
import { GlobalProvidersPanel } from "@/components/admin/settings/global-providers-panel"
import { AgentSandboxPanel } from "@/components/admin/settings/agent-sandbox-panel"

const UNIEAI_PROVIDER_URL = process.env.NEXT_PUBLIC_UNIEAI_PROVIDER_URL || ""
const UNIEAI_PROVIDER_KEY = process.env.NEXT_PUBLIC_UNIEAI_PROVIDER_KEY || ""

type AdminSettings = {
    defaultUserRole?: string | null
    pendingMessage?: string | null
    fileAttachmentSessionOnly?: boolean | null
    workModelUrl?: string | null
    workModelKey?: string | null
    workModelName?: string | null
    taskModelUrl?: string | null
    taskModelKey?: string | null
    taskModelName?: string | null
    visionModelUrl?: string | null
    visionModelKey?: string | null
    visionModelName?: string | null
    agentDefaultWorkspacePersistence?: boolean | null
    agentDefaultMemoryMb?: number | null
    agentDefaultCpuMillicores?: number | null
    agentDefaultPidLimit?: number | null
    agentDefaultIdleTimeoutMinutes?: number | null
    agentPortRangeStart?: number | null
    agentPortRangeEnd?: number | null
}

interface Props {
    initialSettings: AdminSettings | undefined
    initialAgentUsers: Array<{
        id: string
        name: string | null
        email: string
        role: string
        settings: {
            useCustomSettings: boolean
            defaults: {
                workspacePersistence: boolean
                memoryMb: number
                cpuMillicores: number
                pidLimit: number
                idleTimeoutMinutes: number
            }
            overrides: {
                workspacePersistence: boolean | null
                memoryMb: number | null
                cpuMillicores: number | null
                pidLimit: number | null
                idleTimeoutMinutes: number | null
            }
            effective: {
                workspacePersistence: boolean
                memoryMb: number
                cpuMillicores: number
                pidLimit: number
                idleTimeoutMinutes: number
                assignedPort: number
            }
        }
        runtime: {
            imageName: string
            containerName: string
            workspaceVolume: string | null
            homeVolume: string | null
            workdir: string
            homeDir: string
            hostPort: number
            bindAddress: string
            networkName: string
            portRange: {
                start: number
                end: number
            }
            workspacePersistence: boolean
            idleTimeoutMinutes: number
            readOnlyRootfs: boolean
            limits: {
                memory: string
                memoryMb: number
                cpus: string
                cpuMillicores: number
                pids: number
            }
        }
    }>
}

export default function AdminSettingsClient({ initialSettings, initialAgentUsers }: Props) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState("models")
    const [isSaving, setIsSaving] = useState(false)
    const [workModels, setWorkModels] = useState<string[]>([])
    const [taskModels, setTaskModels] = useState<string[]>([])
    const [visionModels, setVisionModels] = useState<string[]>([])
    const [fileAttachmentSessionOnly, setFileAttachmentSessionOnly] = useState<boolean>(
        initialSettings?.fileAttachmentSessionOnly ?? false
    )
    const [agentDefaultWorkspacePersistence, setAgentDefaultWorkspacePersistence] = useState<boolean>(
        initialSettings?.agentDefaultWorkspacePersistence ?? true
    )

    const [showWorkKey, setShowWorkKey] = useState(false)
    const [showTaskKey, setShowTaskKey] = useState(false)
    const [showVisionKey, setShowVisionKey] = useState(false)

    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})

    const fetchModels = async (type: string, urlId: string, keyId: string, setModels: (models: string[]) => void) => {
        const urlInput = document.getElementById(urlId) as HTMLInputElement
        const keyInput = document.getElementById(keyId) as HTMLInputElement

        if (!urlInput?.value || !keyInput?.value) {
            toast.error("請提供 API URL 與 Key")
            return
        }

        setLoadingMap(prev => ({ ...prev, [type]: true }))
        try {
            const res = await fetch(`${urlInput.value}/models`, {
                headers: { Authorization: `Bearer ${keyInput.value}` }
            })
            const data = await res.json()
            const models = Array.isArray(data.data) ? data.data : []
            setModels(models.map((m: any) => m.id))
            toast.success("模型清單更新成功")
        } catch {
            toast.error("讀取失敗，請檢查網路或 API 設定")
        } finally {
            setLoadingMap(prev => ({ ...prev, [type]: false }))
        }
    }

    const applyUnieAIAndFetchModels = async (
        type: string,
        urlId: string,
        keyId: string,
        setModels: (models: string[]) => void
    ) => {
        if (!UNIEAI_PROVIDER_URL || !UNIEAI_PROVIDER_KEY) {
            toast.error("NEXT_PUBLIC_UNIEAI_PROVIDER_URL 或 KEY 未設定")
            return
        }

        const urlInput = document.getElementById(urlId) as HTMLInputElement | null
        const keyInput = document.getElementById(keyId) as HTMLInputElement | null
        if (!urlInput || !keyInput) return

        urlInput.value = UNIEAI_PROVIDER_URL
        keyInput.value = UNIEAI_PROVIDER_KEY
        await fetchModels(type, urlId, keyId, setModels)
    }

    const inputClasses = "w-full h-11 rounded-2xl border-none ring-1 ring-border/50 bg-muted/30 px-4 text-sm focus:ring-2 focus:ring-primary/40 focus:bg-background transition-all duration-300 outline-none"
    const labelClasses = "block text-[13px] font-bold text-foreground/70 mb-2 ml-1 tracking-wide"
    const sectionClasses = "p-6 md:p-8 rounded-[32px] border border-border/30 bg-background/40 shadow-sm space-y-6"

    return (
        <div className="h-full flex flex-col bg-background/50">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 flex-shrink-0 border-b border-border/20 bg-background/60 backdrop-blur-xl px-6 py-5 md:px-12">
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                        系統設定
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1.5 font-medium">
                        調整全站核心參數與 AI 模型供應鏈
                    </p>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-5xl mx-auto px-6 py-10 md:px-12">
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault()
                            setIsSaving(true)
                            try {
                                await adminConfigActions(new FormData(e.currentTarget))
                                toast.success("設定已儲存")
                                router.refresh()
                            } catch {
                                toast.error("儲存失敗")
                            } finally {
                                setIsSaving(false)
                            }
                        }}
                        className="space-y-10"
                    >
                        <Tabs.Root
                            defaultValue="models"
                            onValueChange={(value) => setActiveTab(value)}   // ← 監聽 Tab 切換
                        >
                            <Tabs.List className="flex border-b border-border/50 mb-8 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
                                <Tabs.Trigger
                                    value="models"
                                    className="px-6 py-3 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    任務模型設定
                                </Tabs.Trigger>
                                <Tabs.Trigger
                                    value="providers"
                                    className="px-6 py-3 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Global Providers
                                </Tabs.Trigger>
                                <Tabs.Trigger
                                    value="other"
                                    className="px-6 py-3 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    其他設定
                                </Tabs.Trigger>
                                <Tabs.Trigger
                                    value="agent"
                                    className="px-6 py-3 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Agent Sandbox
                                </Tabs.Trigger>
                            </Tabs.List>

                            <Tabs.Content value="models" className="space-y-10">
                                {[
                                    {
                                        id: "work",
                                        title: "Work Model",
                                        icon: <Sparkles className="h-5 w-5" />,
                                        desc: "負責標題生成與內容摘要",
                                        url: "workModelUrl",
                                        key: "workModelKey",
                                        name: "workModelName",
                                        models: workModels,
                                        setter: setWorkModels,
                                        showKey: showWorkKey,
                                        setShowKey: setShowWorkKey
                                    },
                                    {
                                        id: "task",
                                        title: "Task Model",
                                        icon: <Zap className="h-5 w-5" />,
                                        desc: "負責 MCP 工具決策與複雜任務",
                                        url: "taskModelUrl",
                                        key: "taskModelKey",
                                        name: "taskModelName",
                                        models: taskModels,
                                        setter: setTaskModels,
                                        showKey: showTaskKey,
                                        setShowKey: setShowTaskKey
                                    },
                                    {
                                        id: "vision",
                                        title: "Vision Model",
                                        icon: <Eye className="h-5 w-5" />,
                                        desc: "負責圖片理解與視覺分析",
                                        url: "visionModelUrl",
                                        key: "visionModelKey",
                                        name: "visionModelName",
                                        models: visionModels,
                                        setter: setVisionModels,
                                        showKey: showVisionKey,
                                        setShowKey: setShowVisionKey
                                    }
                                ].map((m) => (
                                    <section key={m.id} className={sectionClasses}>
                                        {/* ... 原來的 Work/Task/Vision 模型設定內容保持不變 ... */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-xl bg-primary/10 text-primary">{m.icon}</div>
                                                <div>
                                                    <h2 className="text-xl font-semibold">{m.title}</h2>
                                                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className={labelClasses}>API Endpoint</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        id={`${m.id}_url`}
                                                        name={m.url}
                                                        placeholder="https://..."
                                                        defaultValue={(initialSettings as any)?.[m.url] || ""}
                                                        className={`${inputClasses} flex-1`}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => applyUnieAIAndFetchModels(m.id, `${m.id}_url`, `${m.id}_key`, m.setter)}
                                                        className="h-11 w-11 shrink-0 rounded-full border border-border/50 bg-background hover:bg-muted transition-colors inline-flex items-center justify-center"
                                                        title="使用 UnieAI 預設"
                                                    >
                                                        <UnieAIIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelClasses}>API Key</label>
                                                <div className="relative flex items-center gap-2">
                                                    <input
                                                        id={`${m.id}_key`}
                                                        name={m.key}
                                                        type={m.showKey ? "text" : "password"}
                                                        placeholder="sk-..."
                                                        defaultValue={(initialSettings as any)?.[m.key] || ""}
                                                        className={`${inputClasses} pr-12`}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => m.setShowKey((prev) => !prev)}
                                                        className="absolute right-3 h-9 w-9 rounded-full hover:bg-muted/80 transition-colors flex items-center justify-center text-muted-foreground"
                                                        title={m.showKey ? "隱藏 API Key" : "顯示 API Key"}
                                                    >
                                                        {m.showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col md:flex-row gap-4 items-end bg-muted/20 p-4 rounded-2xl">
                                            <div className="flex-1 w-full">
                                                <label className={labelClasses}>指定模型名稱</label>
                                                {m.models.length > 0 ? (
                                                    <select name={m.name} defaultValue={(initialSettings as any)?.[m.name] || ""} className={inputClasses}>
                                                        {m.models.map((id) => (
                                                            <option key={id} value={id}>
                                                                {id}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        name={m.name}
                                                        placeholder="請先獲取模型或手動輸入..."
                                                        defaultValue={(initialSettings as any)?.[m.name] || ""}
                                                        className={inputClasses}
                                                    />
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => fetchModels(m.id, `${m.id}_url`, `${m.id}_key`, m.setter)}
                                                disabled={loadingMap[m.id]}
                                                className="h-11 px-6 rounded-xl bg-background border border-border/50 text-sm font-bold hover:bg-primary hover:text-primary-foreground transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                                            >
                                                <RefreshCw className={`h-4 w-4 ${loadingMap[m.id] ? "animate-spin" : ""}`} />
                                                獲取清單
                                            </button>
                                        </div>
                                    </section>
                                ))}

                                <div className="pb-8" />
                            </Tabs.Content>

                            <Tabs.Content value="providers">
                                <GlobalProvidersPanel />
                            </Tabs.Content>

                            <Tabs.Content value="agent" className="space-y-10">
                                <AgentSandboxPanel users={initialAgentUsers} />
                                <div className="pb-8" />
                            </Tabs.Content>

                            <Tabs.Content value="other" className="space-y-10">
                                {/* 註冊行為設定 */}
                                <section className={sectionClasses}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                            <Globe className="h-5 w-5" />
                                        </div>
                                        <h2 className="text-xl font-semibold">註冊行為</h2>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className={labelClasses}>預設用戶權限</label>
                                            <select name="defaultUserRole" defaultValue={initialSettings?.defaultUserRole || "pending"} className={inputClasses}>
                                                <option value="pending">審核中 (Pending)</option>
                                                <option value="user">正式用戶 (User)</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className={labelClasses}>待審核頁面文字</label>
                                            <textarea
                                                name="pendingMessage"
                                                defaultValue={initialSettings?.pendingMessage ?? ""}
                                                className="w-full rounded-2xl border-none ring-1 ring-border/50 bg-muted/30 p-4 text-sm focus:ring-2 focus:ring-primary/40 focus:bg-background transition-all outline-none"
                                                rows={3}
                                            />
                                        </div>
                                    </div>
                                </section>

                                {/* 對話附加檔案設定 */}
                                <section className={sectionClasses}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                            <Paperclip className="h-5 w-5" />
                                        </div>
                                        <h2 className="text-xl font-semibold">對話附加檔案設定</h2>
                                    </div>

                                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">附加檔案僅適用於當次對話</p>
                                            <div className="text-xs text-muted-foreground mt-0.5 space-y-1">
                                                <p>啟用後，每次對話的附件解析結果不會保留至後續對話；</p>
                                                <p>關閉後（預設），解析內容會自動嵌入後續的對話歷史中。</p>
                                            </div>
                                        </div>
                                        <Switch checked={fileAttachmentSessionOnly} onCheckedChange={setFileAttachmentSessionOnly} />
                                        <input type="hidden" name="fileAttachmentSessionOnly" value={fileAttachmentSessionOnly ? "true" : "false"} />
                                    </div>
                                </section>

                                <section className={sectionClasses}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                            <Zap className="h-5 w-5" />
                                        </div>
                                        <h2 className="text-xl font-semibold">Agent Sandbox 預設</h2>
                                    </div>

                                    <div className="text-xs text-muted-foreground bg-muted/20 rounded-2xl p-4">
                                        這些值是所有使用者的預設 sandbox 限額。使用者若沒有在個人設定中覆寫，就會直接沿用這裡。
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className={labelClasses}>預設記憶體上限 (MB)</label>
                                            <input
                                                name="agentDefaultMemoryMb"
                                                type="number"
                                                min={512}
                                                max={8192}
                                                defaultValue={initialSettings?.agentDefaultMemoryMb ?? 2048}
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>預設 CPU 上限 (millicores)</label>
                                            <input
                                                name="agentDefaultCpuMillicores"
                                                type="number"
                                                min={250}
                                                max={4000}
                                                defaultValue={initialSettings?.agentDefaultCpuMillicores ?? 1000}
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>預設 PID 上限</label>
                                            <input
                                                name="agentDefaultPidLimit"
                                                type="number"
                                                min={64}
                                                max={1024}
                                                defaultValue={initialSettings?.agentDefaultPidLimit ?? 256}
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>預設閒置逾時 (分鐘)</label>
                                            <input
                                                name="agentDefaultIdleTimeoutMinutes"
                                                type="number"
                                                min={5}
                                                max={240}
                                                defaultValue={initialSettings?.agentDefaultIdleTimeoutMinutes ?? 30}
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Sandbox Port Range Start</label>
                                            <input
                                                name="agentPortRangeStart"
                                                type="number"
                                                min={1025}
                                                max={65534}
                                                defaultValue={initialSettings?.agentPortRangeStart ?? 14108}
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Sandbox Port Range End</label>
                                            <input
                                                name="agentPortRangeEnd"
                                                type="number"
                                                min={1035}
                                                max={65535}
                                                defaultValue={initialSettings?.agentPortRangeEnd ?? 18108}
                                                className={inputClasses}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">預設保留工作區</p>
                                            <div className="text-xs text-muted-foreground mt-0.5 space-y-1">
                                                <p>開啟：使用 persistent Docker volume。</p>
                                                <p>關閉：預設改用 tmpfs，container 重啟後不保留檔案。</p>
                                            </div>
                                        </div>
                                        <Switch checked={agentDefaultWorkspacePersistence} onCheckedChange={setAgentDefaultWorkspacePersistence} />
                                        <input
                                            id="agentDefaultWorkspacePersistence"
                                            type="hidden"
                                            name="agentDefaultWorkspacePersistence"
                                            value={agentDefaultWorkspacePersistence ? "true" : "false"}
                                        />
                                    </div>
                                </section>

                                <div className="pb-8" />
                            </Tabs.Content>
                        </Tabs.Root>

                        {/* 懸浮儲存按鈕 */}
                        {activeTab !== "providers" && activeTab !== "agent" && (
                            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 w-full max-w-[200px]">
                                <button
                                    disabled={isSaving}
                                    type="submit"
                                    className="group w-full h-14 bg-primary text-primary-foreground rounded-full shadow-[0_8px_30px_rgb(var(--primary)/0.4)] hover:shadow-[0_8px_30px_rgb(var(--primary)/0.6)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 font-bold"
                                >
                                    {isSaving ? (
                                        <RefreshCw className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="h-5 w-5" />
                                            <span>儲存變更</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    )
}
