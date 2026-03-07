"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Paperclip, Loader2, CircleCheck, CircleX, Square } from "lucide-react"
import { toast } from "sonner"
import { AttachmentThumbnail } from "./attachment-thumbnail"
import { fileToBase64 } from "./utils"
import type { Attachment } from "./types"
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_DOC_TYPES } from "./types"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type AgentStatus = "idle" | "starting" | "connected" | "error"

export function ChatInput({
    input,
    setInput,
    attachments,
    setAttachments,
    isGenerating,
    isSetupBlocked,
    onSubmit,
    onHandleFileSelect,
    onPreviewAttachment,
    selectedPreviewAttachment,
    mode,
    setMode,
    agentStatus,
    setAgentStatus,
    setAgentStartedAt,
    agentBusy = false,
    agentPendingCount = 0,
    onAgentAbort,
}: {
    input: string
    setInput: (value: string) => void
    attachments: Attachment[]
    setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>
    isGenerating: boolean
    isSetupBlocked: boolean
    onSubmit: (e?: React.FormEvent) => void
    onHandleFileSelect: (files: FileList | null, isEdit?: boolean) => void
    onPreviewAttachment: (att: Attachment) => void
    selectedPreviewAttachment: Attachment | null
    mode: "normal" | "agent"
    setMode: (mode: "normal" | "agent") => void
    agentStatus: AgentStatus
    setAgentStatus: (status: AgentStatus) => void
    setAgentStartedAt: (ts: number | null) => void
    agentBusy?: boolean
    agentPendingCount?: number
    onAgentAbort?: () => void
}) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const agentStartAttemptedRef = useRef(false)

    const [agentVersion, setAgentVersion] = useState<string | null>(null)

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
        }
    }, [input])

    const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault();

        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                if (mode === "agent") {
                    toast.error("Agent 模式目前不支援圖片附件");
                    continue;
                }
                const file = item.getAsFile();
                if (!file) continue;

                if (!file.type.match(/^(image\/(png|jpeg|jpg|webp))$/)) {
                    toast.error("目前僅支援 PNG / JPEG / WebP 格式的貼上圖片");
                    continue;
                }

                try {
                    const base64 = await fileToBase64(file);
                    const previewUrl = URL.createObjectURL(file);

                    const newAttachment: Attachment = {
                        name: `pasted-${Date.now()}.${file.type.split('/')[1] || 'png'}`,
                        mimeType: file.type,
                        base64,
                        previewUrl,
                    };

                    setAttachments(prev => [...prev, newAttachment]);
                    toast.success("已貼上圖片作為附件");

                } catch (err) {
                    console.error("貼上圖片失敗", err);
                    toast.error("無法處理貼上的圖片");
                }

                return;
            }
        }

        const text = e.clipboardData.getData('text/plain');
        if (text) {
            const start = textareaRef.current?.selectionStart ?? 0;
            const end = textareaRef.current?.selectionEnd ?? 0;
            const current = input;

            const newValue = current.slice(0, start) + text + current.slice(end);
            setInput(newValue);

            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = start + text.length;
                    textareaRef.current.selectionEnd = start + text.length;
                }
            }, 0);
        }

    }, [input, setAttachments, setInput]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            onSubmit()
        }
    }

    const pollHealth = useCallback(async (maxAttempts = 20, intervalMs = 1500): Promise<boolean> => {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const res = await fetch("/api/agent")
                const data = await res.json()
                if (data.healthy) {
                    setAgentStatus("connected")
                    setAgentVersion(data.version || null)
                    setAgentStartedAt(null)
                    return true
                }
            } catch { /* ignore, keep polling */ }
            await new Promise(r => setTimeout(r, intervalMs))
        }
        return false
    }, [setAgentStatus, setAgentStartedAt])

    const startAgentSandbox = useCallback(async () => {
        setAgentStatus("starting")
        setAgentVersion(null)
        setAgentStartedAt(Date.now())

        try {
            const res = await fetch("/api/agent", { method: "POST" })
            const data = await res.json()

            if (data.healthy) {
                setAgentStatus("connected")
                setAgentVersion(data.version || null)
                setAgentStartedAt(null)
                // toast.success(`Agent sandbox 已連線 (v${data.version})`)
                return
            }

            if (data.error) {
                setAgentStatus("error")
                setAgentStartedAt(null)
                toast.error(data.error)
                return
            }

            // Container started but not healthy yet — poll until ready
            const ok = await pollHealth()
            if (!ok) {
                setAgentStatus("error")
                setAgentStartedAt(null)
                toast.error("Agent sandbox 啟動逾時，請檢查 Docker 是否運行中")
            }
        } catch (err) {
            setAgentStatus("error")
            setAgentStartedAt(null)
            toast.error("無法連線到 Agent API")
        }
    }, [pollHealth, setAgentStatus, setAgentStartedAt])

    const handleModeChange = useCallback(async (value: string) => {
        if (value === "agent") {
            setMode("agent")
            setAgentStatus("starting")
            setAgentStartedAt(Date.now())

            // Quick health check first — if already running, skip startup
            try {
                const res = await fetch("/api/agent")
                const data = await res.json()
                if (data.healthy) {
                    setAgentStatus("connected")
                    setAgentVersion(data.version || null)
                    setAgentStartedAt(null)
                    return
                }
            } catch { /* not running, proceed to start */ }

            await startAgentSandbox()
        } else {
            agentStartAttemptedRef.current = false
            setMode("normal")
            setAgentStatus("idle")
            setAgentVersion(null)
            setAgentStartedAt(null)
            // Clear providers from opencode, then stop Docker container
            fetch("/api/agent/providers/clear", { method: "POST" })
                .catch(() => { })
                .finally(() => {
                    fetch("/api/agent", { method: "DELETE" }).catch(() => { })
                })
        }
    }, [startAgentSandbox, setMode, setAgentStatus, setAgentStartedAt])

    useEffect(() => {
        if (mode === "agent" && agentStatus === "idle" && !agentStartAttemptedRef.current) {
            agentStartAttemptedRef.current = true
            handleModeChange("agent")
        }
    }, [agentStatus, handleModeChange, mode])

    // Periodically check health while in agent mode
    useEffect(() => {
        if (mode !== "agent" || agentStatus !== "connected") return

        const interval = setInterval(async () => {
            try {
                const res = await fetch("/api/agent")
                const data = await res.json()
                if (!data.healthy) {
                    setAgentStatus("error")
                    setAgentVersion(null)
                }
            } catch {
                setAgentStatus("error")
                setAgentVersion(null)
            }
        }, 30000)

        return () => clearInterval(interval)
    }, [mode, agentStatus])

    const agentIndicator = () => {
        switch (agentStatus) {
            case "starting":
                return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
            case "connected":
                return <CircleCheck className="h-3 w-3 text-emerald-500" />
            case "error":
                return <CircleX className="h-3 w-3 text-red-500" />
            default:
                return null
        }
    }

    return (
        <div className="bg-background px-4 py-4 shrink-0">
            <div
                className={`relative mx-auto flex flex-col rounded-[24px] bg-muted/30 transition-all shadow-sm
                             border border-border/80 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 focus-within:bg-background
                             hover:border-primary/30
                             ${selectedPreviewAttachment ? 'max-w-full' : 'max-w-3xl'}`}
            >
                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-5 pt-4 pb-0">
                        {attachments.map((att, i) => (
                            <AttachmentThumbnail key={i} attachment={att} onRemove={() => setAttachments(prev => prev.filter((_, j) => j !== i))} onClick={() => onPreviewAttachment(att)} />
                        ))}
                    </div>
                )}

                <textarea
                    ref={textareaRef}
                    value={input}
                    onPaste={handlePaste}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={mode === "agent" ? "輸入指令給 Agent sandbox..." : "輸入訊息或拖曳檔案/圖片至此處... (Shift+Enter 換行)"}
                    disabled={isGenerating || isSetupBlocked}
                    rows={1}
                    className={`w-full resize-none bg-transparent px-5 py-4 text-[15px] leading-relaxed focus:outline-none placeholder:text-muted-foreground disabled:opacity-50 min-h-[56px] max-h-[30vh] overflow-y-auto scrollbar-hide ${attachments.length > 0 ? 'pt-3' : ''}`}
                />

                <div className="flex items-center justify-between px-3 pb-3 pt-1">
                    <div className="flex items-center gap-3">
                        <input ref={fileInputRef} type="file" multiple className="hidden"
                            accept={`${ACCEPTED_IMAGE_TYPES},${ACCEPTED_DOC_TYPES}`}
                            onChange={e => { onHandleFileSelect(e.target.files); e.target.value = '' }}
                        />
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isGenerating || isSetupBlocked || mode === "agent"}
                            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                            title={mode === "agent" ? "Agent 模式目前不支援附件" : "附加圖片或文件"}
                        >
                            <Paperclip className="h-5 w-5" />
                        </button>
                        <Tabs value={mode} onValueChange={(v) => handleModeChange(v)} className="rounded-xl">
                            <TabsList className="rounded-2xl">
                                <TabsTrigger value="normal" className="rounded-xl">
                                    Normal
                                </TabsTrigger>
                                <TabsTrigger
                                    value="agent"
                                    disabled={agentStatus === "starting"}
                                    className="data-[state=active]:text-blue-600 rounded-xl gap-1.5"
                                >
                                    Agent
                                    {mode === "agent" && agentIndicator()}
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                        {mode === "agent" && agentPendingCount > 0 && (
                            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-600">
                                Pending {agentPendingCount}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {mode === "agent" && agentBusy && (
                            <button type="button" onClick={() => onAgentAbort?.()}
                                className="flex items-center justify-center p-2.5 rounded-full transition-all duration-200 bg-red-500 text-white hover:bg-red-600 shadow-md transform hover:scale-105 active:scale-95"
                                title="停止目前執行中的 Agent"
                            >
                                <Square className="h-4 w-4 fill-current" />
                            </button>
                        )}
                        <button type="button" onClick={() => onSubmit()}
                            disabled={(!input.trim() && attachments.length === 0) || isGenerating || isSetupBlocked || (mode === "agent" && agentStatus !== "connected")}
                            className={`flex items-center justify-center p-2.5 rounded-full transition-all duration-200
                                ${(!input.trim() && attachments.length === 0)
                                    ? 'bg-muted/80 text-muted-foreground'
                                    : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transform hover:scale-105 active:scale-95'
                                } disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none mr-1`}
                            title={mode === "agent" && agentBusy ? "加入 pending queue" : "送出"}
                        >
                            {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 pl-0.5" />}
                        </button>
                    </div>
                </div>
            </div>
            <p className="text-xs text-muted-foreground/50 text-center mt-3 font-medium">AI 助手可能會產生錯誤資訊，請小心查證。</p>
        </div>
    )
}
