import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import { X, FileText, Loader2, ChevronDown } from "lucide-react"
import { useAgentStore } from "@/hooks/use-agent-store"
import { AgentPartsRenderer } from "@/components/agent/agent-parts-renderer"
import { AgentProgressTicker } from "@/components/agent/agent-progress-ticker"
import { AgentToolCallCard } from "@/components/chat/agent-components"
import { toAgentMessages } from "@/components/chat/utils"
import type { Attachment, UIMessage } from "@/components/chat/types"
import type { AgentPart, AgentMessage, AgentTextPart } from "@/lib/agent/types"

import { Drawer, DrawerContent, DrawerTitle, DrawerHeader } from "@/components/ui/drawer"

export function FilePreviewSidebar({ attachment, onClose }: { attachment: Attachment, onClose: () => void }) {
    const isImage = attachment.mimeType.startsWith('image/')

    // We need useEffect to convert base64 PDFs into Blob URLs
    // Browsers block data:application/pdf base64 strings in iframes for security
    const [objectUrl, setObjectUrl] = useState<string | null>(null)

    useEffect(() => {
        let url = ""
        if (attachment.previewUrl) {
            url = attachment.previewUrl
            setObjectUrl(url)
        } else if (attachment.base64) {
            if (attachment.mimeType === 'application/pdf') {
                try {
                    const byteCharacters = atob(attachment.base64)
                    const byteNumbers = new Array(byteCharacters.length)
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i)
                    }
                    const byteArray = new Uint8Array(byteNumbers)
                    const blob = new Blob([byteArray], { type: 'application/pdf' })
                    url = URL.createObjectURL(blob)
                    setObjectUrl(url)
                } catch (e) {
                    // Fallback if atob fails
                    url = `data:${attachment.mimeType};base64,${attachment.base64}`
                    setObjectUrl(url)
                }
            } else {
                url = `data:${attachment.mimeType};base64,${attachment.base64}`
                setObjectUrl(url)
            }
        }

        return () => {
            // Only revoke if we created a blob URL
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url)
            }
        }
    }, [attachment])

    return (
        <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "50%", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="border-l border-border bg-card shadow-xl overflow-hidden shrink-0 z-20 relative h-full flex flex-col w-[500px]"
            style={{ width: "50%" }}
        >
            <div className="flex items-center justify-between p-4 border-b border-border bg-background shrink-0">
                <div className="flex flex-col overflow-hidden px-2">
                    <p className="text-sm font-semibold truncate" title={attachment.name}>{attachment.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{attachment.mimeType}</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors shrink-0">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/20">
                {!objectUrl ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
                    </div>
                ) : isImage ? (
                    <img src={objectUrl} alt={attachment.name} className="max-w-full max-h-full rounded-md shadow-sm border border-border object-contain" />
                ) : attachment.mimeType === 'application/pdf' ? (
                    <iframe src={objectUrl} className="w-full h-full rounded-md border border-border bg-white" title={attachment.name} />
                ) : (
                    <div className="text-center p-8 bg-background border border-border shadow-sm rounded-xl max-w-sm">
                        <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="text-sm font-medium mb-1 truncate">{attachment.name}</h3>
                        <p className="text-xs text-muted-foreground mb-4">無法在瀏覽器中直接預覽此格式 ({attachment.mimeType})</p>
                        <a href={objectUrl} download={attachment.name} className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors bg-primary text-primary-foreground rounded-md shadow hover:bg-primary/90">
                            下載檔案
                        </a>
                    </div>
                )}
            </div>
        </motion.div>
    )
}


export function AgentToolFlowSidebar({
    message,
    localePrefix,
    onClose,
}: {
    message: UIMessage
    localePrefix: string
    onClose: () => void
}) {
    const calls = message.agentToolCalls || []
    const running = calls.some((call) => call.status === "pending" || call.status === "running")

    return (
        <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "30%", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="border-l border-border bg-card shadow-xl overflow-hidden shrink-0 z-20 relative h-full flex flex-col w-[300px]"
            style={{ width: "30%" }}
        >
            <div className="flex items-center justify-between p-4 border-b border-border bg-background">
                <div className="flex flex-col overflow-hidden px-2">
                    <p className="text-sm font-semibold truncate">工具流程</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                        {running ? "RUNNING" : "FINISHED"} · {calls.length} STEPS
                    </p>
                </div>
                <button onClick={onClose} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors shrink-0">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
                {calls.length === 0 ? (
                    <div className="rounded-xl border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
                        目前沒有工具流程可顯示。
                    </div>
                ) : (
                    calls.map((call, index) => (
                        <AgentToolCallCard
                            key={`${message.id}-flow-${call.id}-${index}`}
                            call={call}
                            localePrefix={localePrefix}
                        />
                    ))
                )}
            </div>
        </motion.div>
    )
}

export function SubAgentSidebar({
    sessionId,
    localePrefix,
    onClose,
    agentFetch,
    paused = false,
}: {
    sessionId: string
    localePrefix: string
    onClose: () => void
    agentFetch: (url: string, init?: RequestInit) => Promise<Response>
    paused?: boolean
}) {
    const subAgentStore = useAgentStore(sessionId)
    const [loading, setLoading] = useState(true)
    const [isBusy, setIsBusy] = useState(false)
    const [autoScroll, setAutoScroll] = useState(true)
    const [showScrollToBottom, setShowScrollToBottom] = useState(false)
    const busyRef = useRef(false)
    const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const autoScrollRef = useRef(true)
    const prevScrollTopRef = useRef(0)

    const loadSubAgentMessages = useCallback(async (): Promise<boolean> => {
        const res = await agentFetch(`/api/agent/session/${encodeURIComponent(sessionId)}/messages`, { cache: "no-store" })
        const payload = await res.json()
        if (!res.ok) {
            throw new Error(payload?.error || "Failed to fetch sub-agent messages")
        }
        const raw = toAgentMessages(payload)
        const storeMessages: AgentMessage[] = []
        const storeParts: Record<string, AgentPart[]> = {}

        raw.forEach((m: any) => {
            const info = m.info || m
            const msgId = String(info.id || m.id || "")
            if (!msgId) return
            const role = String(info.role || m.role || "assistant")
            storeMessages.push({
                id: msgId,
                sessionID: sessionId,
                role: role === "user" ? "user" : "assistant",
                finish: info.finish || m.finish || "",
                time: info.time || m.time,
            })
            const parts = Array.isArray(m.parts) ? m.parts : []
            storeParts[msgId] = parts
                .filter((p: any) => p?.type)
                .map((p: any, idx: number) => ({
                    ...p,
                    id: p.id || `${msgId}-p-${idx}`,
                } as AgentPart))
        })

        subAgentStore.dispatch({
            type: "BULK_LOAD",
            sessionID: sessionId,
            messages: storeMessages,
            parts: storeParts,
        })
        const lastMessage = storeMessages[storeMessages.length - 1]
        if (!lastMessage) return false
        if (lastMessage.role === "user") return true
        const lastAssistant = [...storeMessages].reverse().find((m) => m.role === "assistant")
        if (!lastAssistant) return false
        const hasFinish = !!lastAssistant.finish
        const hasCompleted = !!(typeof lastAssistant.time === "object" && lastAssistant.time?.completed)
        return !hasFinish && !hasCompleted
    }, [agentFetch, sessionId, subAgentStore.dispatch])

    useEffect(() => {
        let cancelled = false

        const scheduleNext = (stillBusy: boolean) => {
            if (cancelled) return
            const delay = stillBusy ? 450 : 1800
            pollRef.current = setTimeout(poll, delay)
        }

        const poll = async () => {
            if (cancelled) return
            let stillBusy = busyRef.current
            try {
                const busy = await loadSubAgentMessages()
                if (!cancelled) {
                    setIsBusy(busy)
                    busyRef.current = busy
                    setLoading(false)
                }
                stillBusy = busy
            } catch {
                if (!cancelled) setLoading(false)
            }
            scheduleNext(stillBusy)
        }

        poll()

        return () => {
            cancelled = true
            if (pollRef.current) {
                clearTimeout(pollRef.current)
                pollRef.current = null
            }
        }
    }, [loadSubAgentMessages])

    const messages = useMemo(
        () =>
            subAgentStore.messages.map((msg) => ({
                id: msg.id,
                role: msg.role,
                parts: subAgentStore.partsFor(msg.id),
            })),
        [subAgentStore.messages, subAgentStore.partsFor]
    )
    const effectiveBusy = isBusy && !paused
    const lastAssistantId = useMemo(
        () => [...messages].reverse().find((m) => m.role === "assistant")?.id,
        [messages]
    )

    useEffect(() => {
        autoScrollRef.current = autoScroll
    }, [autoScroll])

    useEffect(() => {
        const container = scrollRef.current
        if (!container) return

        const onScroll = () => {
            const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
            const isAtBottom = distanceToBottom < 20
            setShowScrollToBottom(!isAtBottom)

            const currentTop = container.scrollTop
            const scrolledUp = currentTop < prevScrollTopRef.current - 2
            prevScrollTopRef.current = currentTop

            if (isAtBottom) {
                if (!autoScrollRef.current) setAutoScroll(true)
            } else if (scrolledUp && autoScrollRef.current) {
                setAutoScroll(false)
            }
        }

        const onWheel = (event: WheelEvent) => {
            if (event.deltaY < 0 && autoScrollRef.current) {
                setAutoScroll(false)
            }
        }

        container.addEventListener("scroll", onScroll, { passive: true })
        container.addEventListener("wheel", onWheel, { passive: true })
        onScroll()
        return () => {
            container.removeEventListener("scroll", onScroll)
            container.removeEventListener("wheel", onWheel)
        }
    }, [])

    useEffect(() => {
        if (!autoScroll) return
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
    }, [messages, autoScroll, loading, effectiveBusy])

    useEffect(() => {
        if (!autoScroll || !effectiveBusy) return
        const container = scrollRef.current
        if (!container) return

        let raf = 0
        const tick = () => {
            if (!autoScrollRef.current) return
            container.scrollTop = container.scrollHeight
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)

        return () => {
            if (raf) cancelAnimationFrame(raf)
        }
    }, [autoScroll, effectiveBusy])

    return (
        <div className="w-full h-full bg-card flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-background">
                <div className="flex flex-col overflow-hidden px-2">
                    <p className="text-sm font-semibold truncate">Sub-Agent</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                        {effectiveBusy ? "RUNNING" : loading ? "LOADING" : "FINISHED"} · {sessionId.slice(0, 12)}
                    </p>
                </div>
                <button onClick={onClose} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors shrink-0">
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-muted/10 relative">
                {loading && messages.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : messages.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No messages yet.</p>
                ) : (
                    <>
                        {messages.map((msg) => (
                            <div key={msg.id} className="space-y-1">
                                <p className={`text-[10px] font-bold uppercase tracking-wider ${msg.role === "user" ? "text-primary/60" : "text-muted-foreground/50"}`}>
                                    {msg.role === "user" ? "User" : "Assistant"}
                                </p>
                                {msg.role === "user" ? (
                                    <div className="text-[12px] text-foreground/90 leading-6">
                                        {msg.parts.filter((p): p is AgentTextPart => p.type === "text").map(p => (
                                            <p key={p.id} className="whitespace-pre-wrap">{p.text}</p>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[13px] leading-6">
                                        <AgentPartsRenderer
                                            parts={msg.parts}
                                            isBusy={effectiveBusy && msg.id === lastAssistantId}
                                            localePrefix={localePrefix}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                        {effectiveBusy && !lastAssistantId && (
                            <AgentProgressTicker className="pt-1" />
                        )}
                    </>
                )}
                <div ref={messagesEndRef} />
                {showScrollToBottom && (
                    <div className="sticky bottom-3 flex justify-center w-full pointer-events-none z-10">
                        <button
                            type="button"
                            onClick={() => {
                                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
                                setAutoScroll(true)
                            }}
                            className="pointer-events-auto flex items-center justify-center h-8 w-8 rounded-full bg-background/85 backdrop-blur border border-border shadow-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                            aria-label="捲動到最底部"
                            title="捲動到最底部"
                        >
                            <ChevronDown className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
