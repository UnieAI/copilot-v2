"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Paperclip } from "lucide-react"
import { toast } from "sonner"
import { streamStore } from "@/lib/stream-store"
import { useTranslations } from "next-intl"
import { useAgentGlow } from "@/components/agent/GlowFlowWrapper"
import { useAgentMode } from "@/components/agent/agent-mode-provider"
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { SetupChecker } from "../setup-checker"
import { Session } from "next-auth"
import { useAgentStore } from "@/hooks/use-agent-store"
import { useInstanceStore } from "@/hooks/use-instance-store"
import { appendInstanceParams } from "@/lib/opencode/client-utils"
import type { AgentPart } from "@/lib/agent/types"

import {
    Attachment, DBMessage, UIMessage, AgentTextPart, AgentReasoningPart,
    AgentToolPart, AgentMessage, AgentToolCall, AgentSelectedModel,
    AgentModelOption, TodoItem, AvailableModel
} from "@/components/chat/types"
import {
    SYSTEM_PROMPT_STORAGE_KEY,
    AGENT_MODEL_STORAGE_KEY, toRecord, toAgentMessages, normalizeAgentProviders,
    readAgentModelStorage, saveAgentModelStorage, getToolStatus, stringifyValue,
    extractSessionIdFromTaskOutput, extractAgentToolCall, parseTodoJson,
    resolveTodoItems, buildActiveToolLabel, toUIAgentMessages, fileToBase64
} from "@/components/chat/utils"
import { FilePreviewSidebar, AgentToolFlowSidebar, SubAgentSidebar } from "@/components/chat/sidebars"
import { ChatHeader } from "@/components/chat/chat-header"
import { ChatMessagesPanel } from "@/components/chat/chat-messages-panel"
import { ChatComposer } from "@/components/chat/chat-composer"
import { useChatSend } from "@/hooks/use-chat-send"
import { useModelPicker } from "@/hooks/use-model-picker"
import { useAgentChatActions } from "@/hooks/use-agent-chat-actions"

// ─── Main Chat Interface ─────────────────────────────────────────────────
export function ChatInterface({
    session,
    sessionId: initialSessionId,
    availableModels,
    initialSelectedModel,
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
    initialQuery?: string
    initialMessages?: DBMessage[]
    initialMode?: "normal" | "agent"
    initialAgentSessionId?: string
    projectId?: string          // if set, new sessions are placed in this project
    onSessionCreated?: (id: string, title: string) => void  // called when a new session is created
}) {
    const router = useRouter()
    const pathname = usePathname()
    const userRole = (session.user as any).role as string ?? "user"
    const searchParams = useSearchParams()
    const segments = pathname?.split('/').filter(Boolean) || []
    const localePrefix = segments.length && segments[0].length <= 5 ? `/${segments[0]}` : ''
    const t = useTranslations('Home')
    const { triggerGlow } = useAgentGlow()
    const { activateAgent, deactivateAgent, activationCount } = useAgentMode()
    const { instance } = useInstanceStore()
    const [sessionId, setSessionId] = useState(initialSessionId)
    const [chatMode, setChatMode] = useState<"normal" | "agent">(initialMode)
    const agentFetch = useCallback(
        (url: string, init?: RequestInit) => fetch(appendInstanceParams(url, instance), init),
        [instance]
    )
    const [agentSessionId, setAgentSessionId] = useState<string | undefined>(initialAgentSessionId)
    const [agentName, setAgentName] = useState<string>("")
    // ── Agent Store ──
    const agentStore = useAgentStore(agentSessionId)
    const [agentModels, setAgentModels] = useState<AgentModelOption[]>([])
    const [agentSelectedModel, setAgentSelectedModel] = useState<AgentSelectedModel | null>(null)
    const [agentModelPickerOpen, setAgentModelPickerOpen] = useState(false)
    const [agentModelSearch, setAgentModelSearch] = useState("")
    const [agentLocalBusy, setAgentLocalBusy] = useState(false) // bridges gap between send and first polling result
    const agentLocalBusyRef = useRef(false)
    const [agentPaused, setAgentPaused] = useState(false)
    const agentPausedRef = useRef(false)
    const agentManualStopRef = useRef(false)
    // Track whether we have an active stream registered in the module store
    const storeKeyRef = useRef<string | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
    const agentSwitchTimerRef = useRef<number | null>(null)
    const [messages, setMessages] = useState<UIMessage[]>(
        initialMessages.map(m => ({
            id: m.id,
            dbId: m.id,
            role: m.role,
            content: m.content,
            attachments: Array.isArray(m.attachments) ? m.attachments : []
        }))
    )
    const [input, setInput] = useState("")
    const [selectedModel, setSelectedModel] = useState(initialSelectedModel || availableModels[0]?.value || "")
    const [systemPrompt, setSystemPrompt] = useState("")
    const [showSystemPrompt, setShowSystemPrompt] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSetupBlocked, setIsSetupBlocked] = useState(false)
    const [isSyncingModels, setIsSyncingModels] = useState(false)
    const [statusText, setStatusText] = useState("")
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState("")
    const [editAttachments, setEditAttachments] = useState<Attachment[]>([])
    const [editKeepAttachments, setEditKeepAttachments] = useState<Attachment[]>([])
    // Split view state
    const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState<Attachment | null>(null)
    const [selectedToolFlowMessageId, setSelectedToolFlowMessageId] = useState<string | null>(null)
    const [subAgentSessionId, setSubAgentSessionId] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const editFileInputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const hasFiredInitialQuery = useRef(false)

    // Scroll state — mirrors the pattern from step2.tsx
    const [isAutoScrolling, setIsAutoScrolling] = useState(true)
    const isAutoScrollingRef = useRef(isAutoScrolling)
    useEffect(() => { isAutoScrollingRef.current = isAutoScrolling }, [isAutoScrolling])
    const [showScrollButton, setShowScrollButton] = useState(false)
    const [isMobileSubAgentDrawer, setIsMobileSubAgentDrawer] = useState(true)

    useEffect(() => {
        agentLocalBusyRef.current = agentLocalBusy
    }, [agentLocalBusy])

    useEffect(() => {
        if (typeof window === "undefined") return
        const update = () => setIsMobileSubAgentDrawer(window.innerWidth <= 768)
        update()
        window.addEventListener("resize", update)
        window.addEventListener("orientationchange", update)
        return () => {
            window.removeEventListener("resize", update)
            window.removeEventListener("orientationchange", update)
        }
    }, [])

    useEffect(() => {
        agentPausedRef.current = agentPaused
    }, [agentPaused])

    // ── Load agent messages (shared by polling and send) ──
    const loadAgentMessages = useCallback(async (targetSessionId?: string) => {
        const id = targetSessionId || agentSessionId
        if (!id) return false
        const res = await agentFetch(`/api/agent/session/${id}/messages`, { cache: "no-store" })
        const payload = await res.json()
        if (!res.ok) {
            throw new Error(payload?.error || "Failed to fetch agent messages")
        }

        // Populate agent store with full message data
        const raw = toAgentMessages(payload)
        const storeMessages: import("@/lib/agent/types").AgentMessage[] = []
        const storeParts: Record<string, AgentPart[]> = {}

        raw.forEach((m: any) => {
            const info = m.info || m
            const msgId = String(info.id || m.id || "")
            if (!msgId) return
            const role = String(info.role || m.role || "assistant")
            storeMessages.push({
                id: msgId,
                sessionID: id,
                role: role === "user" ? "user" : "assistant",
                finish: info.finish || m.finish || "",
                time: info.time || m.time,
            })
            const parts = Array.isArray(m.parts) ? m.parts : []
            storeParts[msgId] = parts
                .filter((p: any) => p?.type)
                .map((p: any, idx: number) => ({
                    ...p,
                    id: p.id || `${msgId}-part-${idx}`,
                } as AgentPart))
        })

        agentStore.dispatch({
            type: "BULK_LOAD",
            sessionID: id,
            messages: storeMessages,
            parts: storeParts,
        })

        if (agentPausedRef.current || agentManualStopRef.current) return false

        // Return whether the agent is still busy (has unfinished assistant messages)
        const lastMessage = storeMessages[storeMessages.length - 1]
        if (!lastMessage) return false
        const lastAssistant = [...storeMessages].reverse().find(m => m.role === "assistant")
        const hasUnfinishedAssistant = !!lastAssistant && !lastAssistant.finish && !(typeof lastAssistant.time === "object" && lastAssistant.time?.completed)
        if (hasUnfinishedAssistant) return true
        if (lastMessage.role === "user" && !agentManualStopRef.current) return true
        return false
    }, [agentFetch, agentSessionId, agentStore.dispatch])

    const loadAgentPendingRequests = useCallback(async (targetSessionId?: string) => {
        const id = targetSessionId || agentSessionId
        if (!id) return
        const [permRes, qRes] = await Promise.all([
            agentFetch(`/api/agent/permission?sessionId=${id}`, { cache: "no-store" }),
            agentFetch(`/api/agent/question?sessionId=${id}`, { cache: "no-store" }),
        ])
        const perms = permRes.ok ? await permRes.json() : []
        const qs = qRes.ok ? await qRes.json() : []
        agentStore.dispatch({
            type: "SET_PENDING_REQUESTS",
            sessionID: id,
            permissions: Array.isArray(perms) ? perms : [],
            questions: Array.isArray(qs) ? qs : [],
        })
    }, [agentFetch, agentSessionId, agentStore.dispatch])

    // Derive busy state for agent mode
    const agentIsBusy = agentStore.isBusy

    // Derive agent UI messages from store + merge optimistic messages
    const agentUIMessages = useMemo((): UIMessage[] => {
        if (chatMode !== "agent") return []
        const storeMessages: UIMessage[] = agentStore.messages.map((msg) => {
            const parts = agentStore.partsFor(msg.id)
            const textBlocks = parts
                .filter((p): p is { type: "text"; id: string; text: string } => p.type === "text")
                .map(p => p.text)
                .filter(Boolean)
            const hasToolParts = parts.some(p => p.type === "tool")
            const hasRunningTool = parts.some(p =>
                p.type === "tool" && (p.state?.status === "running" || p.state?.status === "pending")
            )
            const isFinished = !!msg.finish
            const hasContent = textBlocks.length > 0 || hasToolParts
            const busy = !agentPaused && (agentIsBusy || agentLocalBusy)

            return {
                id: msg.id,
                dbId: msg.id,
                role: msg.role === "user" ? "user" as const : "assistant" as const,
                content: textBlocks.join("\n\n"),
                isStreaming: msg.role === "assistant" ? (!agentPaused && (hasRunningTool || (hasContent && !isFinished && busy))) : false,
                agentToolCalls: [], // We render via AgentPartsRenderer instead
            }
        })

        // Merge optimistic messages — but drop agent-user-* once the store has real user messages
        // (the store gets populated by polling/full sync, which returns the real user message from OpenCode)
        const storeHasUserMsg = storeMessages.some(m => m.role === "user")
        const optimistic = messages.filter(m => {
            if (m.id.startsWith("agent-user-")) return !storeHasUserMsg
            if (m.id.startsWith("agent-error-") || m.id.startsWith("agent-wait-") || m.id.startsWith("agent-regen-wait-")) return true
            return false
        })
        return [...storeMessages, ...optimistic]
    }, [chatMode, agentStore.messages, agentStore.partsFor, agentIsBusy, agentLocalBusy, agentPaused, messages])

    // IntersectionObserver: show/hide the scroll button based on messagesEndRef visibility
    useEffect(() => {
        const chatContainer = scrollContainerRef.current
        const messagesEnd = messagesEndRef.current
        if (!chatContainer || !messagesEnd) return

        const checkScrollPosition = (isEndVisible?: boolean) => {
            const { scrollHeight, scrollTop, clientHeight } = chatContainer
            const distanceToBottom = scrollHeight - scrollTop - clientHeight
            const isAtBottom = Math.abs(distanceToBottom) < 1

            const containerRect = chatContainer.getBoundingClientRect()
            const endRect = messagesEnd.getBoundingClientRect()
            const computedVisible =
                typeof isEndVisible !== "undefined"
                    ? isEndVisible
                    : endRect.top >= containerRect.top && endRect.bottom <= containerRect.bottom
            setShowScrollButton(prev => {
                if (isAutoScrollingRef.current) return false
                const next = computedVisible ? false : !isAtBottom
                if (prev === next) return prev
                return next
            })
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => checkScrollPosition(entry.isIntersecting))
            },
            { root: chatContainer, threshold: 0.1 }
        )
        observer.observe(messagesEnd)

        const handleScroll = () => checkScrollPosition()
        chatContainer.addEventListener("scroll", handleScroll)

        const resizeObserver = new ResizeObserver(() => checkScrollPosition())
        resizeObserver.observe(chatContainer)

        checkScrollPosition()

        return () => {
            chatContainer.removeEventListener("scroll", handleScroll)
            resizeObserver.disconnect()
            observer.disconnect()
        }
    }, [])

    // rAF loop + wheel listener: the core auto-scroll engine
    useEffect(() => {
        if (!isAutoScrolling) return

        const chatContainer = scrollContainerRef.current
        if (!chatContainer) return

        let animationFrameId: number

        // Use direct scrollTop assignment — calling scrollIntoView({ behavior: "smooth" })
        // on every frame starts a new animation each frame and causes severe jitter.
        // rAF at ~60fps is already visually smooth without a CSS animation.
        const tick = () => {
            chatContainer.scrollTop = chatContainer.scrollHeight
            animationFrameId = requestAnimationFrame(tick)
        }

        const handleWheel = (event: WheelEvent) => {
            if (chatContainer.contains(event.target as Node)) {
                setIsAutoScrolling(false)
            }
        }

        animationFrameId = requestAnimationFrame(tick)
        window.addEventListener("wheel", handleWheel, { passive: true })

        return () => {
            cancelAnimationFrame(animationFrameId)
            window.removeEventListener("wheel", handleWheel)
        }
    }, [isAutoScrolling])

    // Start auto-scroll when generation begins; stop when it ends
    const prevIsGeneratingRef = useRef(false)
    useEffect(() => {
        if (isGenerating && !prevIsGeneratingRef.current) {
            setIsAutoScrolling(true)
        }
        prevIsGeneratingRef.current = isGenerating
    }, [isGenerating])

    useEffect(() => {
        if (availableModels.length > 0 && !selectedModel) {
            setSelectedModel(availableModels[0].value)
        }
    }, [availableModels])

    // Keep prompt input when route changes from /chat -> /c/[id] in the same tab.
    useEffect(() => {
        if (typeof window === "undefined") return
        const saved = window.sessionStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY)
        if (saved !== null) setSystemPrompt(saved)
    }, [])

    useEffect(() => {
        if (typeof window === "undefined") return
        const value = systemPrompt.trim()
        if (!value) {
            window.sessionStorage.removeItem(SYSTEM_PROMPT_STORAGE_KEY)
            return
        }
        window.sessionStorage.setItem(SYSTEM_PROMPT_STORAGE_KEY, systemPrompt)
    }, [systemPrompt])
    useEffect(() => {
        const mode = searchParams?.get("mode") === "agent" ? "agent" : "normal"
        setChatMode(mode)
        if (mode === "agent") {
            const id = searchParams?.get("id") || undefined
            setAgentSessionId(id)
        }
    }, [searchParams])

    const agentChatHref = useCallback((id?: string) => {
        const query = new URLSearchParams()
        query.set("mode", "agent")
        if (id) query.set("id", id)
        return `${localePrefix}/chat?${query.toString()}`
    }, [localePrefix])

    const ensureAgentSession = useCallback(async () => {
        if (agentSessionId) return agentSessionId
        const res = await agentFetch("/api/agent/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        })
        const payload = await res.json()
        if (!res.ok) {
            throw new Error(payload?.error || "Failed to create agent session")
        }
        const id = String(payload?.id || payload?.info?.id || payload?.sessionID || "")
        if (!id) {
            throw new Error("OpenCode returned an invalid session id")
        }
        setAgentSessionId(id)
        router.replace(agentChatHref(id))
        return id
    }, [agentSessionId, agentChatHref, router])

    const agentPollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Agent sync (polling only) ──
    useEffect(() => {
        if (chatMode !== "agent" || !agentSessionId) {
            if (agentPollRef.current) { clearTimeout(agentPollRef.current); agentPollRef.current = null }
            return
        }

        let cancelled = false
        const scheduleNext = (stillBusy: boolean) => {
            if (cancelled) return
            const delay = stillBusy ? 450 : 1800
            agentPollRef.current = setTimeout(poll, delay)
        }

        // On mount (page load / session switch), check opencode's actual session
        // status so we don't falsely resume a stopped generation.
        // Non-blocking — runs in parallel with the first poll.
        if (!agentLocalBusyRef.current) {
            agentFetch("/api/agent/session/status", { cache: "no-store" })
                .then(async (res) => {
                    if (cancelled || !res.ok) return
                    const statusMap = await res.json()
                    const sessionStatus = statusMap?.[agentSessionId] || statusMap?.data?.[agentSessionId]
                    const type = String(sessionStatus?.type || sessionStatus?.status || "idle").toLowerCase()
                    if (type !== "busy" && type !== "running" && type !== "processing") {
                        agentManualStopRef.current = true
                        setAgentLocalBusy(false)
                        setIsGenerating(false)
                        setStatusText("")
                    }
                })
                .catch(() => {})
        }

        const poll = async () => {
            if (cancelled) return
            let stillBusy = agentLocalBusyRef.current
            try {
                const [pollBusy] = await Promise.all([
                    loadAgentMessages(agentSessionId),
                    loadAgentPendingRequests(agentSessionId),
                ])
                const nextBusy = Boolean(pollBusy)
                if (!cancelled) {
                    setAgentLocalBusy(nextBusy)
                }
                stillBusy = nextBusy
            } catch {
                // silent — polling will retry next interval
            }
            scheduleNext(stillBusy)
        }

        // Initial sync immediately
        poll()

        return () => {
            cancelled = true
            if (agentPollRef.current) { clearTimeout(agentPollRef.current); agentPollRef.current = null }
        }
    }, [chatMode, agentSessionId, agentFetch, loadAgentMessages, loadAgentPendingRequests])

    useEffect(() => {
        if (chatMode !== "agent") return
        if (agentPaused || agentManualStopRef.current) {
            setIsGenerating(false)
            setStatusText("")
            return
        }
        const busy = agentIsBusy || agentLocalBusy
        setIsGenerating(busy)
        setStatusText(busy ? "Agent 思考中..." : "")
    }, [chatMode, agentIsBusy, agentLocalBusy, agentPaused])

    useEffect(() => {
        if (chatMode !== "agent") return
        agentFetch("/api/agent/agents", { cache: "no-store" })
            .then(async (res) => {
                if (!res.ok) return []
                const payload = await res.json()
                if (Array.isArray(payload)) return payload
                if (Array.isArray(payload?.data)) return payload.data
                if (Array.isArray(payload?.agents)) return payload.agents
                return []
            })
            .then((list) => {
                const names = list
                    .map((item: any) => String(item?.name || ""))
                    .filter(Boolean)
                if (names.length === 0) return
                const preferred =
                    names.find((name: string) => name === "build") ||
                    names.find((name: string) => name === "plan") ||
                    names[0]
                setAgentName(preferred)
            })
            .catch(() => { })
    }, [chatMode])

    const ensureAgentModel = useCallback(async (providerID: string, modelID: string) => {
        await agentFetch("/api/agent/providers/ensure", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ providerPrefix: providerID, modelID }),
        }).catch(() => { /* non-blocking */ })
    }, [agentFetch])

    // On page refresh with agent mode already active, bump activationCount once
    // so the model sync effect below fires exactly once.
    const didInitActivation = useRef(false)
    useEffect(() => {
        if (didInitActivation.current) return
        didInitActivation.current = true
        if (initialMode === "agent" && activationCount === 0) {
            activateAgent()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Fetch agent providers/models when user explicitly enters agent mode ──
    // Triggered ONLY by activationCount (bumped by activateAgent from provider).
    // Does NOT re-trigger on new chat, send, URL changes, or HMR.
    const prevActivationRef = useRef(0)
    useEffect(() => {
        if (activationCount === 0 || activationCount === prevActivationRef.current) return
        prevActivationRef.current = activationCount

        setIsSyncingModels(true)
        agentFetch("/api/agent/providers/sync", { method: "POST", cache: "no-store" })
            .then(async (res) => {
                if (!res.ok) return
                const payload = await res.json()
                const { models, defaultModel } = normalizeAgentProviders(payload)
                setAgentModels(models)
                const stored = readAgentModelStorage()
                let picked: { providerID: string; modelID: string } | null = null
                if (stored && models.some(m => m.providerID === stored.providerID && m.modelID === stored.modelID)) {
                    picked = stored
                } else if (defaultModel) {
                    picked = defaultModel
                } else if (models.length > 0) {
                    picked = { providerID: models[0].providerID, modelID: models[0].modelID }
                }
                if (picked) {
                    setAgentSelectedModel(picked)
                    ensureAgentModel(picked.providerID, picked.modelID)
                }
            })
            .catch(() => { })
            .finally(() => setIsSyncingModels(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activationCount])

    useEffect(() => {
        if (chatMode !== "agent") {
            setSubAgentSessionId(null)
            return
        }
        setMessages([])
        setAttachments([])
        setEditingId(null)
        setSelectedPreviewAttachment(null)
        setSelectedToolFlowMessageId(null)
        setSubAgentSessionId(null)
        agentManualStopRef.current = false
        setAgentPaused(false)
        setAgentLocalBusy(false)
        agentStore.dispatch({ type: "RESET" })
    }, [chatMode])

    useEffect(() => {
        setSubAgentSessionId(null)
    }, [agentSessionId])

    useEffect(() => {
        return () => {
            if (agentSwitchTimerRef.current !== null) {
                window.clearTimeout(agentSwitchTimerRef.current)
                agentSwitchTimerRef.current = null
            }
        }
    }, [])

    // ── Mount: reconnect to live stream if it exists ──
    useEffect(() => {
        // If there's already a live stream for this session, subscribe to it
        if (initialSessionId && streamStore.isActive(initialSessionId)) {
            const snap = streamStore.getSnapshot(initialSessionId)
            if (snap) {
                setMessages(snap.messages as UIMessage[])
                setIsGenerating(snap.isGenerating)
            }
            const unsub = streamStore.subscribe(initialSessionId, (msgs, generating, status) => {
                setMessages(msgs as UIMessage[])
                setIsGenerating(generating)
                setStatusText(status)
            })
            storeKeyRef.current = initialSessionId
            return unsub  // cleanup: just removes listener, stream stays alive
        }

        // Cleanup on unmount: if a stream is registered under our key, just remove listeners
        return () => {
            // nothing to do — streamStore keeps the stream alive for reconnect
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // intentionally only on mount

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
        }
    }, [input])

    const getMimeType = (file: File) => {
        if (file.type) return file.type;
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        switch (ext) {
            case 'jpg':
            case 'jpeg': return 'image/jpeg';
            case 'png': return 'image/png';
            case 'gif': return 'image/gif';
            case 'webp': return 'image/webp';
            case 'pdf': return 'application/pdf';
            case 'csv': return 'text/csv';
            case 'txt': return 'text/plain';
            case 'md': return 'text/markdown';
            case 'doc': return 'application/msword';
            case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            case 'json': return 'application/json';
            case 'js':
            case 'jsx':
            case 'ts':
            case 'tsx':
            case 'html':
            case 'css':
            case 'py': return 'text/plain';
            default: return 'application/octet-stream';
        }
    }

    const handleFileSelect = async (files: FileList | null, isEdit = false) => {
        if (!files) return
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

    const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault(); // 重要：先阻止預設的貼上文字行為

        const items = e.clipboardData?.items;
        if (!items) return;

        // 優先找 image 類型的資料
        for (const item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (!file) continue;

                // 這裡可以再過濾只接受 jpg/png/jpeg/gif 等
                if (!file.type.match(/^(image\/(png|jpeg|jpg|gif|webp))$/)) {
                    toast.error("目前僅支援 PNG / JPEG / GIF / WebP 格式的貼上圖片");
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

                return; // 找到一張圖就處理，結束迴圈
            }
        }

        // 如果沒有圖片，就允許正常文字貼上
        const text = e.clipboardData.getData('text/plain');
        if (text) {
            // 你可以選擇直接插入文字，或是呼叫 document.execCommand('insertText')
            // 但因為你用的是 controlled textarea，最簡單的方式是手動插入
            const start = textareaRef.current?.selectionStart ?? 0;
            const end = textareaRef.current?.selectionEnd ?? 0;
            const current = input;

            const newValue = current.slice(0, start) + text + current.slice(end);
            setInput(newValue);

            // 移動游標到貼上後的位置
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = start + text.length;
                    textareaRef.current.selectionEnd = start + text.length;
                }
            }, 0);
        }

    }, [input, setAttachments]);

    const sendAgentMessage = useCallback(async (
        content: string,
        atts: Attachment[],
        _msgEditId?: string,
        keptAtts: Attachment[] = []
    ) => {
        const allAtts = [...keptAtts, ...atts]
        if (!content.trim() && allAtts.length === 0) return
        if (isGenerating) return
        if (allAtts.length > 0) {
            toast.error("Agent 模式暫不支援附加檔案")
            return
        }

        const userMessageId = `agent-user-${Date.now()}`
        const userMsg: UIMessage = { id: userMessageId, role: "user", content }

        setSubAgentSessionId(null)
        setMessages((prev) => [...prev, userMsg])
        setInput("")
        setAttachments([])
        setAgentPaused(false)
        agentManualStopRef.current = false
        setIsGenerating(true)
        setAgentLocalBusy(true)
        setStatusText("Agent 思考中...")

        try {
            // Ensure model is synced to opencode BEFORE sending the prompt
            if (agentSelectedModel) {
                await ensureAgentModel(agentSelectedModel.providerID, agentSelectedModel.modelID)
            }
            const sid = await ensureAgentSession()
            const promptBody: Record<string, unknown> = {
                text: content,
                agent: agentName || undefined,
            }
            if (agentSelectedModel) {
                promptBody.model = {
                    providerID: agentSelectedModel.providerID,
                    modelID: agentSelectedModel.modelID,
                }
            }
            const res = await agentFetch(`/api/agent/session/${sid}/prompt`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(promptBody),
            })
            const payload = await res.json()
            if (!res.ok) {
                throw new Error(payload?.error || "Failed to send agent prompt")
            }

            // Polling handles updates — do a quick load for initial state
            await loadAgentMessages(sid)
        } catch (error: any) {
            setMessages((prev) =>
                [...prev, {
                    id: `agent-error-${Date.now()}`,
                    role: "assistant",
                    content: error?.message || "Agent 回覆失敗，請稍後再試",
                    isStreaming: false,
                }]
            )
            setIsGenerating(false)
            setAgentLocalBusy(false)
            setStatusText("")
            toast.error(error?.message || "Agent 回覆失敗")
        }
    }, [agentName, agentSelectedModel, ensureAgentModel, ensureAgentSession, isGenerating, loadAgentMessages])

    const { handleAgentStopGeneration, handleAgentRegenerate } = useAgentChatActions({
        agentSessionId,
        agentFetch,
        agentStoreDispatch: agentStore.dispatch,
        agentStoreMessages: agentStore.messages,
        agentStorePartsFor: agentStore.partsFor,
        agentName,
        agentSelectedModel,
        isGenerating,
        loadAgentMessages,
        setSubAgentSessionId,
        setSelectedToolFlowMessageId,
        setAgentPaused,
        agentManualStopRef,
        setIsGenerating,
        setAgentLocalBusy,
        setStatusText,
        setMessages,
    })

    const {
        isValidUuid,
        sendMessage,
        handleSubmit,
        handleStopGeneration,
        handleRegenerate,
    } = useChatSend({
        chatMode,
        isGenerating,
        isSetupBlocked,
        input,
        attachments,
        messages,
        setMessages,
        setIsGenerating,
        setStatusText,
        setInput,
        setAttachments,
        selectedModel,
        availableModels,
        systemPrompt,
        sessionId,
        setSessionId,
        projectId,
        localePrefix,
        router,
        onSessionCreated,
        storeKeyRef,
        abortControllerRef,
        sendAgentMessage,
        onStopAgentGeneration: handleAgentStopGeneration,
        onRegenerateAgentMessage: handleAgentRegenerate,
    })

    // Handle auto-starting chat from home page query
    useEffect(() => {
        if (initialQuery && !hasFiredInitialQuery.current && messages.length === 0 && selectedModel) {
            hasFiredInitialQuery.current = true;
            // Clear the query from URL after grabbing it
            window.history.replaceState({}, '', '/chat');
            // Auto submit needs to happen after next tick so sendMessage is ready
            setTimeout(() => {
                sendMessage(initialQuery, []);
            }, 0);
        }
    }, [initialQuery, messages.length, selectedModel, sendMessage]);

    const startEdit = (msg: UIMessage) => {
        if (chatMode === "agent") return
        setEditingId(msg.id)
        setEditContent(msg.content)
        setEditAttachments([])
        // Store FULL attachment data (including base64) so we can re-send them
        setEditKeepAttachments(
            (msg.attachments || []).map(a => ({
                name: a.name,
                mimeType: a.mimeType,
                base64: a.base64 || '',
            }))
        )
    }

    const cancelEdit = () => { setEditingId(null); setEditAttachments([]); setEditKeepAttachments([]) }

    const commitEdit = (msg: UIMessage) => {
        if (msg.role === 'user') {
            // Only pass dbId if it's a real UUID; otherwise send without editMessageId
            const safeEditId = isValidUuid(msg.dbId) ? msg.dbId : undefined
            sendMessage(editContent, editAttachments, safeEditId, editKeepAttachments)
        } else {
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: editContent } : m))
        }
        cancelEdit()
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // e.keyCode === 229 is the universal code for an IME composing event (even if isComposing just flipped to false)
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
            e.preventDefault()
            handleSubmit()
        }
    }

    const {
        modelPickerOpen,
        setModelPickerOpen,
        modelSearch,
        setModelSearch,
        selectedModelObj,
        selectedModelLabel,
        handleModelChange,
        filteredUserModels,
        filteredGlobalModels,
        groupEntries,
        hasAnyMatch,
    } = useModelPicker({
        availableModels,
        selectedModel,
        setSelectedModel,
        sessionId,
    })

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        const files = e.dataTransfer.files
        if (files && files.length > 0) {
            handleFileSelect(files)
        }
    }

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.dataTransfer.types.includes('Files')) {
            setIsDragging(true)
        }
    }

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        // Improve reliability: only set false if leaving the window area
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setIsDragging(false)
    }

    const normalChatHref = useMemo(() => {
        if (projectId) {
            return sessionId
                ? `${localePrefix}/p/${projectId}/c/${sessionId}`
                : `${localePrefix}/p/${projectId}`
        }
        return sessionId ? `${localePrefix}/c/${sessionId}` : `${localePrefix}/chat`
    }, [localePrefix, projectId, sessionId])

    const selectedToolFlowMessage = useMemo(() => {
        if (!selectedToolFlowMessageId) return null
        return messages.find((message) => message.id === selectedToolFlowMessageId) || null
    }, [messages, selectedToolFlowMessageId])

    const hasRightPanel = !!selectedPreviewAttachment || !!selectedToolFlowMessage

    useEffect(() => {
        if (!selectedToolFlowMessageId) return
        const exists = messages.some((message) => message.id === selectedToolFlowMessageId)
        if (!exists) setSelectedToolFlowMessageId(null)
    }, [messages, selectedToolFlowMessageId])

    const openAttachmentPreview = useCallback((attachment: Attachment) => {
        setSelectedToolFlowMessageId(null)
        setSelectedPreviewAttachment(attachment)
    }, [])

    const openToolFlow = useCallback((messageId: string) => {
        setSelectedPreviewAttachment(null)
        setSubAgentSessionId(null)
        setSelectedToolFlowMessageId(messageId)
    }, [])

    const openSubAgent = useCallback((childSessionId: string) => {
        setSelectedPreviewAttachment(null)
        setSelectedToolFlowMessageId(null)
        setSubAgentSessionId(childSessionId)
    }, [])

    const switchToAgentMode = useCallback(() => {
        if (isGenerating) return
        activateAgent()
        router.push(agentChatHref(agentSessionId))
    }, [activateAgent, agentChatHref, agentSessionId, isGenerating, router])

    const switchToAgentModeWithGlow = useCallback(() => {
        if (isGenerating) return
        triggerGlow({
            color: "rgba(129, 140, 248, 0.96)",
            secondaryColor: "rgba(59, 130, 246, 0.92)",
            holdMs: 1000,
            borderRadius: 32,
        })
        if (agentSwitchTimerRef.current !== null) {
            window.clearTimeout(agentSwitchTimerRef.current)
        }
        agentSwitchTimerRef.current = window.setTimeout(() => {
            agentSwitchTimerRef.current = null
            switchToAgentMode()
        }, 90)
    }, [isGenerating, switchToAgentMode, triggerGlow])

    const switchToNormalMode = useCallback(() => {
        setSubAgentSessionId(null)
        deactivateAgent()
        agentFetch("/api/agent/providers/clear", { method: "POST" }).catch(() => {})
        // Always open a new chat when leaving agent mode
        const newChatHref = projectId ? `${localePrefix}/p/${projectId}` : `${localePrefix}/chat`
        router.push(newChatHref)
    }, [agentFetch, deactivateAgent, localePrefix, projectId, router])

    const handleAgentModelSelect = useCallback((providerID: string, modelID: string) => {
        const model = { providerID, modelID }
        setAgentSelectedModel(model)
        saveAgentModelStorage(model)
        setAgentModelPickerOpen(false)
        ensureAgentModel(providerID, modelID)
    }, [ensureAgentModel])

    // Agent model picker: filtered models
    const agentModelSearchTerm = agentModelSearch.trim().toLowerCase()
    const filteredAgentModels = agentModelSearchTerm
        ? agentModels.filter(m =>
            m.modelName.toLowerCase().includes(agentModelSearchTerm) ||
            m.providerName.toLowerCase().includes(agentModelSearchTerm) ||
            m.modelID.toLowerCase().includes(agentModelSearchTerm)
        )
        : agentModels

    const agentSelectedModelLabel = agentSelectedModel
        ? agentModels.find(m => m.providerID === agentSelectedModel.providerID && m.modelID === agentSelectedModel.modelID)?.modelName || agentSelectedModel.modelID
        : "Select Model"
    const agentSelectedModelProvider = agentSelectedModel
        ? agentModels.find(m => m.providerID === agentSelectedModel.providerID && m.modelID === agentSelectedModel.modelID)?.providerName || agentSelectedModel.providerID
        : ""

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

            <div className="relative flex-1 min-w-0 flex flex-col h-full bg-background border-r border-border">

                <ChatHeader
                    chatMode={chatMode}
                    showSystemPrompt={showSystemPrompt}
                    onToggleSystemPrompt={() => setShowSystemPrompt((v) => !v)}
                    systemPrompt={systemPrompt}
                    onSystemPromptChange={setSystemPrompt}
                    modelPickerOpen={chatMode === "agent" ? agentModelPickerOpen : modelPickerOpen}
                    onModelPickerOpenChange={chatMode === "agent" ? setAgentModelPickerOpen : setModelPickerOpen}
                    modelSearch={chatMode === "agent" ? agentModelSearch : modelSearch}
                    onModelSearchChange={chatMode === "agent" ? setAgentModelSearch : setModelSearch}
                    selectedModel={
                        chatMode === "agent" && agentSelectedModel
                            ? `${agentSelectedModel.providerID}-${agentSelectedModel.modelID}`
                            : selectedModel
                    }
                    selectedModelObj={
                        chatMode === "agent" && agentSelectedModel
                            ? { providerName: agentSelectedModelProvider } as any
                            : selectedModelObj
                    }
                    selectedModelLabel={chatMode === "agent" ? agentSelectedModelLabel : selectedModelLabel}
                    filteredUserModels={chatMode === "agent"
                        ? availableModels.filter(m => m.source === "user" && (agentModelSearch ? m.label.toLowerCase().includes(agentModelSearch.toLowerCase()) : true))
                        : filteredUserModels}
                    filteredGlobalModels={chatMode === "agent"
                        ? availableModels.filter(m => m.source === "group" && !m.groupId && (agentModelSearch ? m.label.toLowerCase().includes(agentModelSearch.toLowerCase()) : true))
                        : filteredGlobalModels}
                    groupEntries={chatMode === "agent"
                        ? (() => {
                            const groupModels = availableModels.filter(m => m.source === "group" && m.groupId && (agentModelSearch ? m.label.toLowerCase().includes(agentModelSearch.toLowerCase()) : true));
                            const map = new Map<string, typeof availableModels>();
                            groupModels.forEach(m => {
                                const key = m.groupName || "Unknown Group";
                                if (!map.has(key)) map.set(key, []);
                                map.get(key)!.push(m);
                            });
                            return Array.from(map.entries()).map(([gName, filtered]) => ({ gName, filtered, total: filtered.length }));
                        })()
                        : groupEntries}
                    hasAnyMatch={chatMode === "agent"
                        ? availableModels.some(m => agentModelSearch ? m.label.toLowerCase().includes(agentModelSearch.toLowerCase()) : true)
                        : hasAnyMatch}
                    onNormalModelSelect={(val) => {
                        if (chatMode === "agent") {
                            const match = availableModels.find(m => m.value === val);
                            if (match) handleAgentModelSelect(match.providerPrefix, match.label);
                        } else {
                            handleModelChange(val);
                        }
                    }}
                    isSyncingModels={isSyncingModels}
                />

                <ChatMessagesPanel
                    scrollContainerRef={scrollContainerRef}
                    messagesEndRef={messagesEndRef}
                    hasRightPanel={hasRightPanel}
                    chatMode={chatMode}
                    localePrefix={localePrefix}
                    messages={messages}
                    agentUIMessages={agentUIMessages}
                    isGenerating={isGenerating}
                    agentSessionId={agentSessionId}
                    greetingSubtitle={t('subtitle') || '今天我能幫你處理什麼？'}
                    statusText={statusText}
                    showScrollButton={showScrollButton}
                    onScrollToBottom={() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
                        setTimeout(() => setIsAutoScrolling(true), 500)
                    }}
                    editingId={editingId}
                    editContent={editContent}
                    onEditContentChange={setEditContent}
                    editKeepAttachments={editKeepAttachments}
                    setEditKeepAttachments={setEditKeepAttachments}
                    editAttachments={editAttachments}
                    setEditAttachments={setEditAttachments}
                    editFileInputRef={editFileInputRef}
                    onHandleFileSelect={handleFileSelect}
                    onCancelEdit={cancelEdit}
                    onCommitEdit={commitEdit}
                    onStartEdit={startEdit}
                    onRegenerate={handleRegenerate}
                    onOpenAttachmentPreview={openAttachmentPreview}
                    getAgentPartsForMessage={agentStore.partsFor}
                    onOpenSubAgent={openSubAgent}
                    permissions={agentStore.permissions}
                    questions={agentStore.questions}
                    isSyncingModels={isSyncingModels}
                />

                <ChatComposer
                    hasRightPanel={hasRightPanel}
                    attachments={attachments}
                    input={input}
                    isGenerating={isGenerating}
                    isSetupBlocked={isSetupBlocked}
                    isSyncingModels={isSyncingModels}
                    chatMode={chatMode}
                    textareaRef={textareaRef}
                    fileInputRef={fileInputRef}
                    onInputChange={setInput}
                    onInputPaste={handlePaste}
                    onInputKeyDown={handleKeyDown}
                    onHandleFileSelect={handleFileSelect}
                    onOpenAttachmentPreview={openAttachmentPreview}
                    onRemoveAttachment={(index) => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                    onToggleMode={(mode) => {
                        if (isGenerating || isSyncingModels) return
                        if (mode === "agent") {
                            switchToAgentModeWithGlow()
                        } else {
                            switchToNormalMode()
                        }
                    }}
                    onStopGeneration={() => { void handleStopGeneration() }}
                    onSubmit={() => handleSubmit()}
                />
            </div>

            {/* Right Grouped Split Sidebar View */}
            <AnimatePresence mode="wait">
                {selectedToolFlowMessage ? (
                    <AgentToolFlowSidebar
                        key="tool-flow"
                        message={selectedToolFlowMessage}
                        localePrefix={localePrefix}
                        onClose={() => setSelectedToolFlowMessageId(null)}
                    />
                ) : selectedPreviewAttachment ? (
                    <FilePreviewSidebar
                        key="file-preview"
                        attachment={selectedPreviewAttachment}
                        onClose={() => setSelectedPreviewAttachment(null)}
                    />
                ) : null}
            </AnimatePresence>

            {/* Sub-Agent Drawer: desktop from right, mobile from bottom */}
            {subAgentSessionId && (
                <Drawer
                    open
                    onOpenChange={(open) => {
                        if (!open) setSubAgentSessionId(null)
                    }}
                    direction={isMobileSubAgentDrawer ? "bottom" : "right"}
                >
                    <DrawerContent
                        className={cn(
                            "p-0 overflow-hidden",
                            isMobileSubAgentDrawer
                                ? "h-[78vh] max-h-[78vh]"
                                : "inset-x-auto left-auto right-0 top-0 bottom-0 mt-0 h-full w-[26%] min-w-[240px] max-w-[340px] rounded-none border-l border-r-0 border-t-0"
                        )}
                    >
                        <DrawerTitle className="sr-only">Sub-Agent Drawer</DrawerTitle>
                        <SubAgentSidebar
                            sessionId={subAgentSessionId}
                            localePrefix={localePrefix}
                            onClose={() => setSubAgentSessionId(null)}
                            agentFetch={agentFetch}
                            paused={agentPaused}
                        />
                    </DrawerContent>
                </Drawer>
            )}

            <SetupChecker userRole={userRole} onBlockingChange={setIsSetupBlocked} />
        </div>
    )
}
