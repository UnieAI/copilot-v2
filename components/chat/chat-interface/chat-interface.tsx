"use client"

import { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Paperclip, ChevronDown, Settings2, CircleCheck, Loader2, CircleX, Server } from "lucide-react"
import { useTranslations } from "next-intl"
import { Session } from "next-auth"
import { toast } from "sonner"
import { DynamicGreeting } from "@/components/ui/dynamic-greeting"
import { SetupChecker } from "@/components/setup-checker"

import type { Attachment, DBMessage, AvailableModel } from "./types"
import { fileToBase64, getMimeType } from "./utils"
import { ModelPicker } from "./model-picker"
import { FilePreviewSidebar } from "./file-preview-sidebar"
import { AttachmentsProgressPanel, StatusBadge } from "./status-indicators"
import { MessageBubble } from "./message-bubble"
import { ChatInput } from "./chat-input"
import { useAutoScroll } from "./hooks/use-auto-scroll"
import { useChatStream } from "./hooks/use-chat-stream"
import { AgentView } from "./agent/agent-view"
import { AgentSidebar } from "./agent/agent-sidebar"
import type { AgentRuntimeConfig, useAgentSession } from "./agent/use-agent-session"

export function ChatInterface({
    session,
    sessionId: initialSessionId,
    availableModels,
    initialSelectedModel,
    initialSystemPrompt,
    initialQuery,
    initialMessages = [],
    initialMode = "normal",
    initialAgentSessionId,
    projectId,
    onSessionCreated,
}: {
    session: Session
    sessionId?: string
    availableModels: AvailableModel[]
    initialSelectedModel?: string
    initialSystemPrompt?: string | null
    initialQuery?: string
    initialMessages?: DBMessage[]
    initialMode?: "normal" | "agent"
    initialAgentSessionId?: string
    projectId?: string
    onSessionCreated?: (id: string, title: string) => void
}) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const currentAgentSessionId = searchParams?.get("id") || initialAgentSessionId || undefined
    const userRole = (session.user as any).role as string ?? "user"
    const t = useTranslations('Home')

    const {
        messages,
        selectedModel,
        systemPrompt,
        setSystemPrompt,
        isGenerating,
        statusText,
        attachmentProgress,
        sendMessage,
        handleRegenerate,
        handleModelChange,
    } = useChatStream({
        initialSessionId,
        initialMessages,
        availableModels,
        initialSelectedModel,
        initialSystemPrompt,
        initialQuery,
        projectId,
        onSessionCreated,
    })

    const { messagesEndRef, scrollContainerRef, showScrollButton, scrollToBottom } = useAutoScroll(isGenerating)

    const [input, setInput] = useState("")
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [showSystemPrompt, setShowSystemPrompt] = useState(false)
    const [isSetupBlocked, setIsSetupBlocked] = useState(false)

    // Agent mode state
    const [mode, setMode] = useState<"normal" | "agent">(initialMode)
    const [agentStatus, setAgentStatus] = useState<"idle" | "starting" | "connected" | "error">("idle")
    const [agentStartedAt, setAgentStartedAt] = useState<number | null>(null)
    const [agentBusy, setAgentBusy] = useState(false)
    const [agentPendingCount, setAgentPendingCount] = useState(0)
    const agentRef = useRef<ReturnType<typeof useAgentSession> | null>(null)
    const handledAgentFreshRef = useRef("")

    useEffect(() => {
        if (mode !== "agent") {
            setAgentBusy(false)
            setAgentPendingCount(0)
        }
    }, [mode])

    useEffect(() => {
        if (agentStatus !== "connected") {
            setAgentBusy(false)
            setAgentPendingCount(0)
        }
    }, [agentStatus])

    useEffect(() => {
        const params = new URLSearchParams(searchParams?.toString() || "")
        if (mode === "agent") {
            params.set("mode", "agent")
        } else {
            params.delete("mode")
            params.delete("id")
        }

        const nextQuery = params.toString()
        const currentQuery = searchParams?.toString() || ""
        if (nextQuery !== currentQuery) {
            router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname)
        }
    }, [mode, pathname, router, searchParams])

    useLayoutEffect(() => {
        if (mode !== "agent" || agentStatus !== "connected") return

        const freshToken =
            searchParams?.get("fresh") ||
            searchParams?.get("new") ||
            ""
        if (!freshToken || handledAgentFreshRef.current === freshToken) return

        handledAgentFreshRef.current = freshToken
        // Reset to homepage (empty welcome screen) — session is created lazily on first sendMessage
        agentRef.current?.resetSession()
    }, [mode, agentStatus, searchParams])

    const handleAgentSessionChange = useCallback((sessionId: string) => {
        const params = new URLSearchParams(searchParams?.toString() || "")
        params.set("mode", "agent")
        params.set("id", sessionId)
        params.delete("fresh")
        params.delete("new")
        const nextQuery = params.toString()
        const currentQuery = searchParams?.toString() || ""
        if (nextQuery !== currentQuery) {
            router.replace(`${pathname}?${nextQuery}`)
        }
    }, [pathname, router, searchParams])

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState("")
    const [editAttachments, setEditAttachments] = useState<Attachment[]>([])
    const [editKeepAttachments, setEditKeepAttachments] = useState<Attachment[]>([])

    // Split view state
    const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState<Attachment | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [showAgentSidebar, setShowAgentSidebar] = useState(false)

    // UUID regex for edit safety
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    const handleFileSelect = async (files: FileList | null, isEdit = false) => {
        if (!files) return
        if (mode === "agent" && !isEdit) {
            toast.error("Agent 模式目前不支援附件")
            return
        }
        const newAtts: Attachment[] = []
        for (const file of Array.from(files)) {
            const mimeType = getMimeType(file)
            const base64 = await fileToBase64(file)
            const canPreview = mimeType.startsWith('image/') || mimeType === 'application/pdf'
            newAtts.push({
                name: file.name,
                mimeType,
                base64,
                previewUrl: canPreview ? URL.createObjectURL(file) : undefined
            })
        }
        if (isEdit) setEditAttachments(prev => [...prev, ...newAtts])
        else setAttachments(prev => [...prev, ...newAtts])
    }

    const selectedAgentRuntimeConfig = useMemo<AgentRuntimeConfig | null>(() => {
        if (!selectedModel) return null

        const matchedModel = availableModels.find((model) => model.value === selectedModel)
        const providerID = matchedModel?.providerPrefix?.trim()
        const modelID = matchedModel?.label?.trim()

        if (providerID && modelID) {
            return {
                agent: "build",
                model: { providerID, modelID },
            }
        }

        const dashIdx = selectedModel.indexOf("-")
        if (dashIdx <= 0) return null

        const fallbackProviderID = selectedModel.slice(0, dashIdx).trim()
        const fallbackModelID = selectedModel.slice(dashIdx + 1).trim()
        if (!fallbackProviderID || !fallbackModelID) return null

        return {
            agent: "build",
            model: {
                providerID: fallbackProviderID,
                modelID: fallbackModelID,
            },
        }
    }, [availableModels, selectedModel])

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (mode === "agent") {
            if (!input.trim() || agentStatus !== "connected") return
            const runtimeConfig = selectedAgentRuntimeConfig
            const selectedAgentModel = runtimeConfig?.model
            if (!selectedAgentModel) {
                toast.warning("請先選擇 Agent 模型")
                return
            }

            const synced = await ensureAgentModel(
                selectedAgentModel.providerID,
                selectedAgentModel.modelID,
                { force: true },
            )
            if (!synced) return

            await agentRef.current?.sendMessage(input.trim(), runtimeConfig)
            setInput("")
            setAttachments([])
            return
        }
        if (isSetupBlocked || isGenerating) return
        sendMessage(input, attachments)
        setInput("")
        setAttachments([])
    }

    const handleAgentAbort = useCallback(() => {
        agentRef.current?.abort()
    }, [])

    // Ensure provider/model is registered in opencode (lazy, server-side)
    const ensuredModelsRef = useRef(new Set<string>())
    const hasSyncedAllModelsRef = useRef(false)
    const selectedModelRef = useRef(selectedModel)
    useEffect(() => {
        selectedModelRef.current = selectedModel
    }, [selectedModel])
    const ensureAgentModel = useCallback(async (
        providerPrefix: string,
        modelID: string,
        options?: { silent?: boolean; force?: boolean },
    ) => {
        const key = `${providerPrefix}/${modelID}`
        if (!options?.force && ensuredModelsRef.current.has(key)) return true
        ensuredModelsRef.current.add(key)
        try {
            const res = await fetch("/api/agent/providers/ensure", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ providerPrefix, modelID }),
            })
            if (res.ok) {
                // toast.success(`已同步模型 ${modelID} 至 Agent`)
                return true
            } else {
                ensuredModelsRef.current.delete(key)
                if (!options?.silent) {
                    toast.warning(`模型 ${modelID} 同步失敗`)
                }
                return false
            }
        } catch {
            ensuredModelsRef.current.delete(key)
            if (!options?.silent) {
                toast.warning(`模型 ${modelID} 同步失敗`)
            }
            return false
        }
    }, [])

    // When agent connects, ensure all available models are registered
    useEffect(() => {
        if (agentStatus !== "connected" || availableModels.length === 0) return
        let cancelled = false
        hasSyncedAllModelsRef.current = false

        const syncAllModels = async () => {
            const targets = new Map<string, { providerPrefix: string; modelID: string }>()

            for (const model of availableModels) {
                const providerPrefix = (model.providerPrefix || "").trim()
                if (!providerPrefix) continue

                const value = String(model.value || "")
                const label = String(model.label || "")
                const modelID = value.startsWith(`${providerPrefix}-`)
                    ? value.slice(providerPrefix.length + 1)
                    : label
                if (!modelID) continue

                const key = `${providerPrefix}/${modelID}`
                if (!targets.has(key)) {
                    targets.set(key, { providerPrefix, modelID })
                }
            }

            let failed = 0
            for (const item of targets.values()) {
                if (cancelled) return
                const ok = await ensureAgentModel(item.providerPrefix, item.modelID, { silent: true })
                if (!ok) failed += 1
            }

            if (!cancelled && failed > 0) {
                toast.warning(`${failed} 個模型同步失敗`)
            }

            if (cancelled) return
            hasSyncedAllModelsRef.current = true

            // Ensure current selected model is the default in opencode after bulk sync.
            if (selectedModelRef.current) {
                const dashIdx = selectedModelRef.current.indexOf("-")
                if (dashIdx > 0) {
                    const prefix = selectedModelRef.current.slice(0, dashIdx)
                    const modelId = selectedModelRef.current.slice(dashIdx + 1)
                    await ensureAgentModel(prefix, modelId, { force: true, silent: true })
                }
            }
        }

        void syncAllModels()

        return () => {
            cancelled = true
        }
    }, [agentStatus, availableModels, ensureAgentModel])

    // Ensure selected model stays as the default model in opencode config
    useEffect(() => {
        if (agentStatus !== "connected" || !selectedModel || !hasSyncedAllModelsRef.current) return
        const dashIdx = selectedModel.indexOf("-")
        if (dashIdx < 0) return
        const prefix = selectedModel.slice(0, dashIdx)
        const modelId = selectedModel.slice(dashIdx + 1)
        void ensureAgentModel(prefix, modelId, { force: true })
    }, [agentStatus, selectedModel, ensureAgentModel])

    // Reset ensured set when agent disconnects
    useEffect(() => {
        if (agentStatus !== "connected") {
            ensuredModelsRef.current = new Set()
            hasSyncedAllModelsRef.current = false
        }
    }, [agentStatus])

    const startEdit = useCallback((msg: any) => {
        setEditingId(msg.id)
        setEditContent(msg.content)
        setEditAttachments([])
        setEditKeepAttachments(
            (msg.attachments || []).map((a: any) => ({
                name: a.name,
                mimeType: a.mimeType,
                base64: a.base64 || '',
            }))
        )
    }, [])

    const cancelEdit = () => { setEditingId(null); setEditAttachments([]); setEditKeepAttachments([]) }

    const commitEdit = useCallback((msg: any) => {
        if (msg.role === 'user') {
            const safeEditId = msg.dbId && UUID_RE.test(msg.dbId) ? msg.dbId : undefined
            sendMessage(editContent, editAttachments, safeEditId, editKeepAttachments)
        }
        cancelEdit()
    }, [editContent, editAttachments, editKeepAttachments, sendMessage])

    // Drag & drop handlers
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        if (mode === "agent") {
            toast.error("Agent 模式目前不支援檔案上傳")
            return
        }
        const files = e.dataTransfer.files
        if (files && files.length > 0) handleFileSelect(files)
    }
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation() }
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation()
        if (e.dataTransfer.types.includes('Files')) setIsDragging(true)
    }
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation()
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setIsDragging(false)
    }

    return (
        <div
            className="flex h-full w-full bg-background overflow-hidden relative"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
        >
            {/* Full-screen drag overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary/50 m-4 rounded-3xl transition-all">
                    <div className="flex flex-col items-center gap-4 text-primary pointer-events-none scale-110 animate-in zoom-in-95 duration-200">
                        <div className="p-4 bg-primary/10 rounded-full">
                            <Paperclip className="h-10 w-10" />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">放開以附加檔案</h3>
                        <p className="text-sm font-medium text-muted-foreground">支援圖片、文件等多種格式</p>
                    </div>
                </div>
            )}

            <div className={`relative flex flex-col h-full bg-background transition-all duration-300 ease-in-out ${selectedPreviewAttachment ? 'w-1/2 min-w-0 border-r border-border' : 'w-full'} `}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-10 shrink-0">
                    <ModelPicker
                        availableModels={availableModels}
                        selectedModel={selectedModel}
                        onModelChange={handleModelChange}
                    />
                    {mode === "agent" ? (
                        <button
                            onClick={() => setShowAgentSidebar(v => !v)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${agentStatus === "connected"
                                ? "text-emerald-600 hover:bg-emerald-500/10"
                                : agentStatus === "starting"
                                    ? "text-blue-600 hover:bg-blue-500/10"
                                    : agentStatus === "error"
                                        ? "text-red-500 hover:bg-red-500/10"
                                        : "text-muted-foreground hover:bg-muted/60"
                                }`}
                        >
                            {agentStatus === "connected" && <CircleCheck className="h-3.5 w-3.5" />}
                            {agentStatus === "starting" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {agentStatus === "error" && <CircleX className="h-3.5 w-3.5" />}
                            {agentStatus === "idle" && <Server className="h-3.5 w-3.5" />}
                            {agentStatus === "connected" ? "Sandbox 已連線" :
                                agentStatus === "starting" ? "啟動中..." :
                                    agentStatus === "error" ? "連線失敗" : "Agent"}
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowSystemPrompt(v => !v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                        >
                            <Settings2 className="h-4 w-4" />
                            Prompt 設定
                        </button>
                    )}
                </div>

                {/* System Prompt Panel */}
                {showSystemPrompt && (
                    <div className="px-4 py-3 border-b border-border bg-muted/30 shrink-0">
                        <textarea
                            value={systemPrompt}
                            onChange={e => setSystemPrompt(e.target.value)}
                            placeholder="輸入 System Prompt（留空則不使用）..."
                            rows={3}
                            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                    </div>
                )}

                {/* Messages Container — Agent or Normal */}
                {mode === "agent" ? (
                    <AgentView
                        agentRef={agentRef}
                        initialSessionId={currentAgentSessionId}
                        onSessionChange={handleAgentSessionChange}
                        agentStatus={agentStatus}
                        agentStartedAt={agentStartedAt}
                        onBusyChange={setAgentBusy}
                        onPendingCountChange={setAgentPendingCount}
                        runtimeConfig={selectedAgentRuntimeConfig || undefined}
                    />
                ) : (
                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-y-auto w-full relative [scrollbar-color:auto_transparent] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:bg-transparent"
                    >
                        <div className={`mx-auto w-full space-y-8 py-8 ${selectedPreviewAttachment ? 'px-6 max-w-full' : 'px-4 max-w-3xl'}`}>
                            {messages.length === 0 && !isGenerating && (
                                <div className="flex flex-col items-center justify-center min-h-[30vh] text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
                                    <h1 className="mt-52 text-4xl font-semibold tracking-tight mb-3 bg-gradient-to-r from-foreground via-foreground/80 to-muted-foreground bg-clip-text">
                                        <DynamicGreeting />
                                    </h1>
                                    <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
                                        {t('subtitle') || '今天我能幫你處理什麼？'}
                                    </p>
                                </div>
                            )}

                            {messages.map((msg) => (
                                <MessageBubble
                                    key={msg.id}
                                    msg={msg}
                                    isGenerating={isGenerating}
                                    editingId={editingId}
                                    editContent={editContent}
                                    editAttachments={editAttachments}
                                    editKeepAttachments={editKeepAttachments}
                                    onStartEdit={startEdit}
                                    onCancelEdit={cancelEdit}
                                    onCommitEdit={commitEdit}
                                    onSetEditContent={setEditContent}
                                    onSetEditAttachments={setEditAttachments}
                                    onSetEditKeepAttachments={setEditKeepAttachments}
                                    onHandleFileSelect={handleFileSelect}
                                    onRegenerate={handleRegenerate}
                                    onPreviewAttachment={setSelectedPreviewAttachment}
                                />
                            ))}

                            {attachmentProgress ? (<AttachmentsProgressPanel attachments={attachmentProgress} />) : (<StatusBadge text={statusText} />)}
                            <div ref={messagesEndRef} className="h-4" />
                        </div>

                        {/* Scroll to bottom floating button */}
                        {showScrollButton && (
                            <div className="sticky bottom-4 flex justify-center w-full pointer-events-none z-20">
                                <button
                                    onClick={scrollToBottom}
                                    className="pointer-events-auto flex items-center justify-center h-8 w-8 rounded-full bg-background/80 backdrop-blur border border-border shadow-md text-muted-foreground hover:text-foreground hover:bg-background transition-all"
                                    aria-label="捲動到最底部"
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Input Area */}
                <ChatInput
                    input={input}
                    setInput={setInput}
                    attachments={attachments}
                    setAttachments={setAttachments}
                    isGenerating={isGenerating}
                    isSetupBlocked={isSetupBlocked}
                    onSubmit={handleSubmit}
                    onHandleFileSelect={handleFileSelect}
                    onPreviewAttachment={setSelectedPreviewAttachment}
                    selectedPreviewAttachment={selectedPreviewAttachment}
                    mode={mode}
                    setMode={setMode}
                    agentStatus={agentStatus}
                    setAgentStatus={setAgentStatus}
                    setAgentStartedAt={setAgentStartedAt}
                    agentBusy={agentBusy}
                    agentPendingCount={agentPendingCount}
                    onAgentAbort={handleAgentAbort}
                />
            </div>

            {/* Split Sidebar View */}
            {selectedPreviewAttachment && (
                <FilePreviewSidebar
                    attachment={selectedPreviewAttachment}
                    onClose={() => setSelectedPreviewAttachment(null)}
                />
            )}

            {/* Agent Sidebar */}
            {mode === "agent" && (
                <AgentSidebar
                    open={showAgentSidebar}
                    agentStatus={agentStatus}
                    currentSessionId={currentAgentSessionId}
                    onClose={() => setShowAgentSidebar(false)}
                />
            )}

            <SetupChecker userRole={userRole} onBlockingChange={setIsSetupBlocked} />
        </div>
    )
}
