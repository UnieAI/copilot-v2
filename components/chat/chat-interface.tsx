"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
    Send, Paperclip, X, RefreshCw, Edit2,
    ChevronDown, ChevronUp, Loader2, Check, Settings2,
    Brain, FileText, Bot, User
} from "lucide-react"
import { toast } from "sonner"
import { streamStore } from "@/lib/stream-store"

// ─── Types ─────────────────────────────────────────────────────────────
type Attachment = {
    name: string
    mimeType: string
    base64: string
    previewUrl?: string
}

type DBMessage = {
    id: string
    role: "user" | "assistant" | "system"
    content: string
    attachments?: { name: string; mimeType: string; base64?: string }[]
    createdAt: string
}

type UIMessage = {
    id: string
    dbId?: string
    role: "user" | "assistant" | "system"
    content: string
    attachments?: { name: string; mimeType: string; base64?: string }[]
    isStreaming?: boolean
}

const ACCEPTED_IMAGE_TYPES = ".jpg,.jpeg,.png"
const ACCEPTED_DOC_TYPES = ".pdf,.doc,.docx,.csv,.txt,.md"

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
    })
}

// ─── Think Tag Parser ──────────────────────────────────────────────────
function ThinkBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
    const [userExpanded, setUserExpanded] = useState<boolean | null>(null)
    const expanded = userExpanded !== null ? userExpanded : !!isStreaming

    return (
        <div className="my-3 flex flex-col gap-2">
            <button
                onClick={() => setUserExpanded(!expanded)}
                className="w-fit flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
            >
                {isStreaming ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/70" />
                ) : (
                    <Brain className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                )}
                <span>思考過程</span>
                {expanded ? <ChevronUp className="h-3 w-3 opacity-50" /> : <ChevronDown className="h-3 w-3 opacity-50" />}
            </button>
            {expanded && (
                <div className="pl-4 ml-[7px] border-l-2 border-border/60 text-[13px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed animate-in fade-in slide-in-from-top-1 duration-300">
                    {content.trim()}
                </div>
            )}
        </div>
    )
}

// Render content with <think>...</think> blocks collapsed
function MessageContent({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
    const parts: { type: 'text' | 'think'; content: string; unfinished?: boolean }[] = []
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g
    let lastIndex = 0
    let match

    while ((match = thinkRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: content.slice(lastIndex, match.index) })
        }
        parts.push({ type: 'think', content: match[1] })
        lastIndex = match.index + match[0].length
    }

    // Handle unclosed <think> tag (still streaming)
    const remaining = content.slice(lastIndex)
    const openThink = remaining.indexOf('<think>')
    if (openThink !== -1) {
        if (openThink > 0) parts.push({ type: 'text', content: remaining.slice(0, openThink) })
        parts.push({ type: 'think', content: remaining.slice(openThink + 7) + (isStreaming ? '▋' : ''), unfinished: !!isStreaming })
    } else if (remaining) {
        parts.push({ type: 'text', content: remaining })
    }

    if (parts.length === 0 && isStreaming) {
        parts.push({ type: 'text', content: '▋' })
    }

    return (
        <div>
            {parts.map((p, i) =>
                p.type === 'think'
                    ? <ThinkBlock key={i} content={p.content} isStreaming={p.unfinished} />
                    : <div key={i} className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-pre:text-xs">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.content}</ReactMarkdown>
                    </div>
            )}
        </div>
    )
}

// ─── Image / File Attachment Thumbnail ───────────────────────────────────
function AttachmentThumbnail({ attachment, onRemove, onClick }: {
    attachment: Attachment
    onRemove?: () => void
    onClick?: () => void
}) {
    const isImage = attachment.mimeType.startsWith('image/')
    const imgSrc = attachment.previewUrl || (attachment.base64 ? `data:${attachment.mimeType};base64,${attachment.base64}` : undefined)

    // Extract simple extension (.pdf, .csv, string)
    let ext = ''
    try {
        const parts = attachment.name.split('.')
        ext = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'DOC'
    } catch { ext = 'FILE' }

    return (
        <div className="group relative h-16 w-16 md:h-20 md:w-20 shrink-0 rounded-2xl border border-border bg-muted overflow-hidden cursor-pointer hover:ring-2 hover:ring-ring transition-all"
            onClick={onClick}>
            {isImage && imgSrc ? (
                <img src={imgSrc} alt="attachment" className="w-full h-full object-cover" />
            ) : (
                <div className="flex flex-col items-center justify-center w-full h-full p-2 text-muted-foreground bg-card">
                    <FileText className="h-6 w-6 md:h-8 md:w-8 mb-1 opacity-80" />
                    <span className="text-[9px] font-bold tracking-wider">{ext}</span>
                </div>
            )}

            {onRemove && (
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove() }}
                    className="absolute -top-1 -right-1 h-5 w-5 bg-background border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                    <X className="h-3 w-3" />
                </button>
            )}
        </div>
    )
}

// ─── Split Right Sidebar for File Previews ──────────────────────────────
function FilePreviewSidebar({ attachment, onClose }: { attachment: Attachment, onClose: () => void }) {
    const isImage = attachment.mimeType.startsWith('image/')
    const imgSrc = attachment.previewUrl || (attachment.base64 ? `data:${attachment.mimeType};base64,${attachment.base64}` : undefined)

    return (
        <div className="w-1/2 min-w-[300px] border-l border-border bg-card flex flex-col h-full animate-in slide-in-from-right-8 duration-300 relative z-20 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border bg-background">
                <div className="flex flex-col overflow-hidden px-2">
                    <p className="text-sm font-semibold truncate" title={attachment.name}>{attachment.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{attachment.mimeType}</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors shrink-0">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/20">
                {isImage && imgSrc ? (
                    <img src={imgSrc} alt={attachment.name} className="max-w-full max-h-full rounded-md shadow-sm border border-border object-contain" />
                ) : attachment.mimeType === 'application/pdf' ? (
                    <iframe src={imgSrc} className="w-full h-full rounded-md border border-border bg-white" title={attachment.name} />
                ) : (
                    <div className="text-center p-8 bg-background border border-border shadow-sm rounded-xl max-w-sm">
                        <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="text-sm font-medium mb-1 truncate">{attachment.name}</h3>
                        <p className="text-xs text-muted-foreground mb-4">無法在瀏覽器中直接預覽此格式 ({attachment.mimeType})</p>
                        {imgSrc && (
                            <a href={imgSrc} download={attachment.name} className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors bg-primary text-primary-foreground rounded-md shadow hover:bg-primary/90">
                                下載檔案
                            </a>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Status Badge ───────────────────────────────────────────────────────
function StatusBadge({ text }: { text: string }) {
    if (!text) return null
    return (
        <div className="flex items-center justify-center gap-2 py-2">
            <div className="flex items-center gap-2 bg-muted/80 backdrop-blur border border-border rounded-full px-4 py-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{text}</span>
            </div>
        </div>
    )
}

// ─── Model Type ─────────────────────────────────────────────────────────
type AvailableModel = {
    value: string      // "{prefix}-{modelId}"
    label: string      // modelId only
    providerName: string
    providerPrefix: string
}

// ─── Main Chat Interface ─────────────────────────────────────────────────
export function ChatInterface({
    sessionId: initialSessionId,
    availableModels,
    initialSelectedModel,
    initialMessages = [],
    projectId,
    onSessionCreated,
}: {
    sessionId?: string
    availableModels: AvailableModel[]
    initialSelectedModel?: string
    initialMessages?: DBMessage[]
    projectId?: string          // if set, new sessions are placed in this project
    onSessionCreated?: (id: string, title: string) => void  // called when a new session is created
}) {
    const router = useRouter()
    const [sessionId, setSessionId] = useState(initialSessionId)
    // Track whether we have an active stream registered in the module store
    const storeKeyRef = useRef<string | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
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
    const [statusText, setStatusText] = useState("")
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState("")
    const [editAttachments, setEditAttachments] = useState<Attachment[]>([])
    const [editKeepAttachments, setEditKeepAttachments] = useState<Attachment[]>([])

    // Split view state
    const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState<Attachment | null>(null)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const editFileInputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Scroll state
    const [userScrolled, setUserScrolled] = useState(false)
    const [showScrollButton, setShowScrollButton] = useState(false)
    const isProgrammaticScrollRef = useRef(false)

    const checkIsAtBottom = useCallback(() => {
        const el = scrollContainerRef.current
        if (!el) return true
        return el.scrollHeight - el.scrollTop - el.clientHeight < 80
    }, [])

    const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
        isProgrammaticScrollRef.current = true
        messagesEndRef.current?.scrollIntoView({ behavior })
        setUserScrolled(false)
        setShowScrollButton(false)
        // Release the programmatic flag after the scroll animation settles
        setTimeout(() => { isProgrammaticScrollRef.current = false }, 400)
    }, [])

    // Detect wheel input: immediately pause auto-scroll when user scrolls up
    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        if (e.deltaY < 0) {
            // Scrolling up — user wants to read history
            setUserScrolled(true)
        }
    }, [])

    // Update scroll button visibility on scroll events
    const handleScroll = useCallback(() => {
        if (isProgrammaticScrollRef.current) return
        const atBottom = checkIsAtBottom()
        setShowScrollButton(!atBottom)
        if (atBottom) {
            setUserScrolled(false)
        }
    }, [checkIsAtBottom])

    // Auto-scroll when messages change, unless user has scrolled away
    useEffect(() => {
        if (!userScrolled) {
            scrollToBottom("smooth")
        }
    }, [messages, statusText]) // eslint-disable-line react-hooks/exhaustive-deps

    // Reset userScrolled for each new generation so it starts auto-scrolling
    const prevIsGeneratingRef = useRef(false)
    useEffect(() => {
        if (isGenerating && !prevIsGeneratingRef.current) {
            setUserScrolled(false)
        }
        prevIsGeneratingRef.current = isGenerating
    }, [isGenerating])

    useEffect(() => {
        if (availableModels.length > 0 && !selectedModel) {
            setSelectedModel(availableModels[0].value)
        }
    }, [availableModels])

    // ── Mount: abort orphaned streams (Bug 1) & reconnect to live stream (Bug 2) ──
    useEffect(() => {
        // Abort any stream that isn't for this session (handles "navigate to /chat" case)
        streamStore.abortAllExcept(initialSessionId)

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

    const handleFileSelect = async (files: FileList | null, isEdit = false) => {
        if (!files) return
        const newAtts: Attachment[] = []
        for (const file of Array.from(files)) {
            const base64 = await fileToBase64(file)
            newAtts.push({
                name: file.name,
                mimeType: file.type,
                base64,
                previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
            })
        }
        if (isEdit) setEditAttachments(prev => [...prev, ...newAtts])
        else setAttachments(prev => [...prev, ...newAtts])
    }

    // UUID regex — only real UUIDs are safe to use as editMessageId
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    const sendMessage = useCallback(async (
        content: string,
        atts: Attachment[],
        msgEditId?: string,
        keptAtts: Attachment[] = []
    ) => {
        const allAtts = [...keptAtts, ...atts]
        if (!content.trim() && allAtts.length === 0) return
        if (isGenerating) return
        if (!selectedModel) {
            toast.error("請先在設定頁面配置並選擇一個模型。")
            return
        }

        // Save model preference (optimistic, non-blocking)
        const selModelObj = availableModels.find(m => m.value === selectedModel)
        if (selModelObj) {
            fetch('/api/user/preference', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selectedModel: selModelObj.label,
                    selectedProviderPrefix: selModelObj.providerPrefix,
                }),
            }).catch(() => { })
        }

        setIsGenerating(true)
        setStatusText("正在連線...")

        const userMsg: UIMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content,
            attachments: allAtts.map(a => ({ name: a.name, mimeType: a.mimeType, base64: a.base64 }))
        }

        // Only use editMessageId if it's a real DB UUID
        const safeEditId = msgEditId && UUID_RE.test(msgEditId) ? msgEditId : undefined

        let historyMessages: UIMessage[]
        if (safeEditId) {
            const cutIdx = messages.findIndex(m => m.dbId === safeEditId)
            historyMessages = cutIdx >= 0 ? messages.slice(0, cutIdx) : messages
        } else {
            historyMessages = messages
        }

        const aiMsgId = `ai-${Date.now()}`
        setMessages([...historyMessages, userMsg, { id: aiMsgId, role: "assistant", content: "", isStreaming: true }])
        setInput("")
        setAttachments([])

        const conversationHistory = historyMessages.map(m => ({ role: m.role, content: m.content }))
        conversationHistory.push({ role: 'user', content })

        try {
            // Create AbortController for this stream
            const ac = new AbortController()
            abortControllerRef.current = ac

            // Use a temporary key for the store before we know the real sessionId
            const tempKey = sessionId || `pending-${Date.now()}`
            const initialStoreMessages: UIMessage[] = [
                ...historyMessages,
                userMsg,
                { id: aiMsgId, role: 'assistant' as const, content: '', isStreaming: true }
            ]
            streamStore.register(tempKey, initialStoreMessages as any, ac)
            storeKeyRef.current = tempKey

            const res = await fetch("/api/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: ac.signal,
                body: JSON.stringify({
                    messages: conversationHistory,
                    sessionId: sessionId || null,
                    selectedModel,
                    systemPrompt: systemPrompt || null,
                    attachments: allAtts,
                    editMessageId: safeEditId || null,
                    projectId: projectId || null,
                })
            })

            if (!res.ok || !res.body) {
                toast.error("請求失敗: " + res.statusText)
                setIsGenerating(false)
                setStatusText("")
                return
            }

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let aiMsgDbId: string | undefined
            let userMsgDbId: string | undefined
            const tempUserMsgId = userMsg.id   // capture before closure changes
            let buffer = ""

            while (true) {
                const { value, done } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    const dataStr = line.slice(6).trim()
                    if (!dataStr) continue
                    try {
                        const ev = JSON.parse(dataStr)
                        if (ev.type === 'session_id') {
                            const realId = ev.data as string
                            // Rekey the store entry from temp key to real session ID
                            if (storeKeyRef.current && storeKeyRef.current !== realId) {
                                streamStore.rekey(storeKeyRef.current, realId)
                                storeKeyRef.current = realId
                            }
                            setSessionId(realId)
                            window.history.pushState({}, '', `/c/${realId}`)
                            onSessionCreated?.(realId, '')
                        } else if (ev.type === 'status') {
                            setStatusText(ev.data)
                            if (storeKeyRef.current) streamStore.update(storeKeyRef.current, e => { e.statusText = ev.data })
                        } else if (ev.type === 'chunk') {
                            setMessages(prev => prev.map(m =>
                                m.id === aiMsgId ? { ...m, content: m.content + ev.data } : m
                            ))
                            if (storeKeyRef.current) streamStore.update(storeKeyRef.current, e => {
                                const msg = e.messages.find(m => m.id === aiMsgId)
                                if (msg) msg.content += ev.data
                            })
                        } else if (ev.type === 'error') {
                            toast.error(ev.data)
                        } else if (ev.type === 'title_updated') {
                            window.dispatchEvent(new CustomEvent('sidebar:refresh'))
                            if (ev.data?.sessionId && ev.data?.title) {
                                onSessionCreated?.(ev.data.sessionId, ev.data.title)
                            }
                        } else if (ev.type === 'done') {
                            aiMsgDbId = ev.data?.messageId
                            userMsgDbId = ev.data?.userMessageId
                            setMessages(prev => prev.map(m => {
                                if (m.id === aiMsgId) return { ...m, isStreaming: false, dbId: aiMsgDbId }
                                if (m.id === tempUserMsgId) return { ...m, dbId: userMsgDbId }
                                return m
                            }))
                            setIsGenerating(false)
                            setStatusText('')
                            // Update store messages to mark done
                            if (storeKeyRef.current) streamStore.update(storeKeyRef.current, e => {
                                const aiMsg = e.messages.find(m => m.id === aiMsgId)
                                if (aiMsg) { aiMsg.isStreaming = false; aiMsg.dbId = aiMsgDbId }
                                const usrMsg = e.messages.find(m => m.id === tempUserMsgId)
                                if (usrMsg) usrMsg.dbId = userMsgDbId
                                e.isGenerating = false
                                e.statusText = ''
                            })
                        }
                    } catch { }
                }
            }
            // Stream fully closed — clean up store and refresh
            if (storeKeyRef.current) {
                streamStore.finish(storeKeyRef.current)
                storeKeyRef.current = null
            }
            router.refresh()

        } catch (e: any) {
            if (e.name === 'AbortError') {
                // User navigated away — clean up silently
                setIsGenerating(false)
                setStatusText('')
                if (storeKeyRef.current) {
                    streamStore.abort(storeKeyRef.current)
                    storeKeyRef.current = null
                }
                return
            }
            toast.error('串流連線失敗: ' + e.message)
        } finally {
            setIsGenerating(false)
            setStatusText('')
        }
    }, [isGenerating, messages, sessionId, selectedModel, systemPrompt, router])

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault()
        sendMessage(input, attachments)
    }

    const handleRegenerate = async (msgId: string) => {
        const idx = messages.findIndex(m => m.id === msgId || m.dbId === msgId)
        if (idx <= 0) return
        const userMsg = messages[idx - 1]
        if (userMsg.role !== 'user') return

        // Use the USER message's dbId as cutoff: deletes user+assistant, then re-inserts both cleanly
        const regenEditId = userMsg.dbId && UUID_RE.test(userMsg.dbId) ? userMsg.dbId : undefined

        const prevMessages = messages.slice(0, idx - 1)
        const aiMsgId = `ai-regen-${Date.now()}`
        setMessages([...prevMessages, userMsg, { id: aiMsgId, role: 'assistant', content: '', isStreaming: true }])
        setIsGenerating(true)
        setStatusText("正在重新生成...")

        const history = [...prevMessages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: userMsg.content }]

        // Carry over the user message's attachments for context
        const userAtts = (userMsg.attachments || []).map(a => ({
            name: a.name,
            mimeType: a.mimeType,
            base64: a.base64 || '',
        }))

        try {
            const res = await fetch("/api/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: history,
                    sessionId,
                    selectedModel,
                    systemPrompt: systemPrompt || null,
                    attachments: userAtts,
                    editMessageId: regenEditId || null,
                })
            })
            if (!res.ok || !res.body) { setIsGenerating(false); setStatusText(""); return }

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""
            let aiMsgDbId: string | undefined
            let newUserMsgDbId: string | undefined
            const existingUserMsgId = userMsg.id   // capture before async

            while (true) {
                const { value, done } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    try {
                        const ev = JSON.parse(line.slice(6).trim())
                        if (ev.type === 'status') setStatusText(ev.data)
                        else if (ev.type === 'chunk') {
                            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + ev.data } : m))
                        } else if (ev.type === 'title_updated') {
                            window.dispatchEvent(new CustomEvent('sidebar:refresh'))
                        } else if (ev.type === 'done') {
                            aiMsgDbId = ev.data?.messageId
                            newUserMsgDbId = ev.data?.userMessageId
                            // Unlock UI immediately (title generation still pending on server)
                            setMessages(prev => prev.map(m => {
                                if (m.id === aiMsgId) return { ...m, isStreaming: false, dbId: aiMsgDbId }
                                // Update user message dbId — server deleted+reinserted it with new UUID
                                if (m.id === existingUserMsgId) return { ...m, dbId: newUserMsgDbId }
                                return m
                            }))
                            setIsGenerating(false)
                            setStatusText("")
                        }
                    } catch { }
                }
            }
            router.refresh()
        } catch { } finally {
            setIsGenerating(false)
            setStatusText("")
        }
    }

    const startEdit = (msg: UIMessage) => {
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
            const safeEditId = msg.dbId && UUID_RE.test(msg.dbId) ? msg.dbId : undefined
            sendMessage(editContent, editAttachments, safeEditId, editKeepAttachments)
        } else {
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: editContent } : m))
        }
        cancelEdit()
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            handleSubmit()
        }
    }

    const [showModelDropdown, setShowModelDropdown] = useState(false)
    // Derived: selected model display label
    const selectedModelObj = availableModels.find(m => m.value === selectedModel)
    const selectedModelLabel = selectedModelObj ? `${selectedModelObj.label}` : (selectedModel || "未選擇模型")

    // Called when user picks a model from the dropdown
    const handleModelChange = (modelValue: string) => {
        setSelectedModel(modelValue)
        setShowModelDropdown(false)

        const modelObj = availableModels.find(m => m.value === modelValue)
        if (!modelObj) return

        // Persist user global preference (non-blocking)
        fetch('/api/user/preference', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                selectedModel: modelObj.label,
                selectedProviderPrefix: modelObj.providerPrefix,
            }),
        }).catch(() => { })

        // If in an existing session, also update the session's model record
        if (sessionId) {
            fetch(`/api/chat/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelName: modelObj.label,
                    providerPrefix: modelObj.providerPrefix,
                }),
            }).catch(() => { })
        }
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        const files = e.dataTransfer.files
        if (files && files.length > 0) {
            handleFileSelect(files)
        }
    }

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
    }

    return (
        <div className="flex h-full w-full bg-background overflow-hidden relative">
            <div className={`relative flex flex-col h-full bg-background transition-all duration-300 ease-in-out ${selectedPreviewAttachment ? 'w-1/2 min-w-0 border-r border-border' : 'w-full'} `}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-10 shrink-0">

                    {/* Gemini-style Model Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowModelDropdown(!showModelDropdown)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-muted/60 transition-colors group"
                        >
                            <div className="flex flex-col items-start">
                                <span className="text-sm font-semibold tracking-tight text-foreground/90 group-hover:text-foreground leading-tight">
                                    {selectedModelLabel}
                                </span>
                                {selectedModelObj && (
                                    <span className="text-[10px] text-muted-foreground leading-tight">{selectedModelObj.providerName}</span>
                                )}
                            </div>
                            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${showModelDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {showModelDropdown && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowModelDropdown(false)} />
                                <div className="absolute top-full left-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="py-2">
                                        <div className="px-3 pb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase border-b border-border/40">
                                            可用模型
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto mt-1">
                                            {availableModels.length === 0 ? (
                                                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                                                    尚未配置任何模型
                                                </div>
                                            ) : (
                                                availableModels.map(m => (
                                                    <button
                                                        key={m.value}
                                                        onClick={() => handleModelChange(m.value)}
                                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between
                                                            ${selectedModel === m.value ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground/80 hover:text-foreground'}
                                                        `}
                                                    >
                                                        <div className="flex flex-col items-start">
                                                            <span>{m.label}</span>
                                                            <span className="text-[10px] text-muted-foreground">{m.providerName}</span>
                                                        </div>
                                                        {selectedModel === m.value && <Check className="h-4 w-4 shrink-0" />}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Settings Toggles */}
                    <button
                        onClick={() => setShowSystemPrompt(v => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                    >
                        <Settings2 className="h-4 w-4" />
                        Prompt 設定
                    </button>
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

                {/* Messages Container */}
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    onWheel={handleWheel}
                    className="flex-1 overflow-y-auto w-full relative"
                >
                    <div className={`mx-auto w-full space-y-8 py-8 ${selectedPreviewAttachment ? 'px-6 max-w-full' : 'px-4 max-w-3xl'}`}>
                        {messages.length === 0 && !isGenerating && (
                            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] gap-4 text-muted-foreground">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                    <Brain className="h-8 w-8 text-muted-foreground/50" />
                                </div>
                                <p className="text-sm font-medium">Hello, how can I help you today?</p>
                            </div>
                        )}

                        {messages.map((msg, index) => (
                            <div key={msg.id} className={`flex w-full group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                                {/* Assistant Avatar */}
                                {msg.role === 'assistant' && (
                                    <div className="flex-shrink-0 mr-4 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mt-1 outline outline-1 outline-border">
                                        <Bot className="h-5 w-5 text-primary" />
                                    </div>
                                )}

                                <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start w-full'}`}>

                                    {/* Edit Mode vs Render Mode */}
                                    {editingId === msg.id ? (
                                        <div className="w-full space-y-3 bg-card p-4 rounded-xl border border-border shadow-sm">
                                            <textarea
                                                value={editContent}
                                                onChange={e => setEditContent(e.target.value)}
                                                rows={4}
                                                autoFocus
                                                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                                            />
                                            {msg.role === 'user' && (
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        {editKeepAttachments.map((att, i) => (
                                                            <AttachmentThumbnail key={`keep-${i}`} attachment={att} onRemove={() => setEditKeepAttachments(prev => prev.filter((_, j) => j !== i))} onClick={() => setSelectedPreviewAttachment(att)} />
                                                        ))}
                                                        {editAttachments.map((att, i) => (
                                                            <AttachmentThumbnail key={`new-${i}`} attachment={att} onRemove={() => setEditAttachments(prev => prev.filter((_, j) => j !== i))} onClick={() => setSelectedPreviewAttachment(att)} />
                                                        ))}
                                                    </div>
                                                    <input type="file" ref={editFileInputRef} className="hidden" multiple
                                                        accept={`${ACCEPTED_IMAGE_TYPES},${ACCEPTED_DOC_TYPES}`}
                                                        onChange={e => { handleFileSelect(e.target.files, true); e.target.value = '' }}
                                                    />
                                                    <button type="button" onClick={() => editFileInputRef.current?.click()}
                                                        disabled={isGenerating}
                                                        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed bg-muted px-3 py-1.5 rounded-md"
                                                    >
                                                        <Paperclip className="h-3.5 w-3.5" /> 附加檔案
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex gap-2 justify-end pt-2">
                                                <button onClick={cancelEdit}
                                                    disabled={isGenerating}
                                                    className="text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    取消
                                                </button>
                                                <button onClick={() => commitEdit(msg)}
                                                    disabled={isGenerating}
                                                    className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                    {msg.role === 'user' ? '儲存並重新生成' : '儲存'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Normal Render */}
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div className={`flex flex-wrap gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                    {msg.attachments.map((att, i) => (
                                                        <AttachmentThumbnail key={i} attachment={{ ...att, base64: att.base64 || '' }} onClick={() => setSelectedPreviewAttachment({ ...att, base64: att.base64 || '' })} />
                                                    ))}
                                                </div>
                                            )}

                                            {msg.content && (
                                                <div className={`
                                                    relative text-[15px] leading-relaxed
                                                    ${msg.role === 'user'
                                                        ? 'bg-muted text-foreground px-5 py-3.5 rounded-[24px] rounded-br-sm'
                                                        : 'bg-transparent text-foreground py-1 w-full'
                                                    }
                                                `}>
                                                    {msg.role === 'assistant'
                                                        ? <MessageContent content={msg.content} isStreaming={msg.isStreaming} />
                                                        : <p className="whitespace-pre-wrap">{msg.content}</p>
                                                    }

                                                    {/* Action buttons (Edit/Regenerate) */}
                                                    {!msg.isStreaming && (
                                                        <div className={`absolute -bottom-9 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'right-0' : '-left-2'}`}>
                                                            <button
                                                                onClick={() => startEdit(msg)}
                                                                disabled={isGenerating}
                                                                className="flex items-center gap-1.5 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted bg-background/50 backdrop-blur-sm border border-transparent hover:border-border transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                                                title="編輯"
                                                            >
                                                                <Edit2 className="h-3.5 w-3.5" />
                                                            </button>
                                                            {msg.role === 'assistant' && (
                                                                <button
                                                                    onClick={() => handleRegenerate(msg.id)}
                                                                    disabled={isGenerating}
                                                                    className="flex items-center gap-1.5 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted bg-background/50 backdrop-blur-sm border border-transparent hover:border-border transition-all disabled:opacity-50 shadow-sm"
                                                                    title="重新生成"
                                                                >
                                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}

                        <StatusBadge text={statusText} />
                        <div ref={messagesEndRef} className="h-4" />
                    </div>

                    {/* Scroll to bottom floating button — sticky inside the scroll container */}
                    {showScrollButton && (
                        <div className="sticky bottom-4 flex justify-center w-full pointer-events-none z-20">
                            <button
                                onClick={() => scrollToBottom("smooth")}
                                className="pointer-events-auto flex items-center justify-center h-8 w-8 rounded-full bg-background/80 backdrop-blur border border-border shadow-md text-muted-foreground hover:text-foreground hover:bg-background transition-all"
                                aria-label="捲動到最底部"
                            >
                                <ChevronDown className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="bg-background px-4 py-4 shrink-0">
                    <div
                        className={`relative mx-auto flex flex-col rounded-[24px] bg-muted/30 transition-all shadow-sm
                                     border border-border/80 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 focus-within:bg-background
                                     hover:border-primary/30
                                     ${selectedPreviewAttachment ? 'max-w-full' : 'max-w-3xl'}`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                    >
                        {/* Attachments Section Inside Input Box */}
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-5 pt-4 pb-0">
                                {attachments.map((att, i) => (
                                    <AttachmentThumbnail key={i} attachment={att} onRemove={() => setAttachments(prev => prev.filter((_, j) => j !== i))} onClick={() => setSelectedPreviewAttachment(att)} />
                                ))}
                            </div>
                        )}

                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="輸入訊息或拖曳檔案/圖片至此處... (Shift+Enter 換行)"
                            disabled={isGenerating}
                            rows={1}
                            className={`w-full resize-none bg-transparent px-5 py-4 text-[15px] leading-relaxed focus:outline-none placeholder:text-muted-foreground disabled:opacity-50 min-h-[56px] max-h-[30vh] overflow-y-auto ${attachments.length > 0 ? 'pt-3' : ''}`}
                        />

                        {/* Input Actions Footer */}
                        <div className="flex items-center justify-between px-3 pb-3 pt-1">
                            <div className="flex items-center gap-1">
                                <input ref={fileInputRef} type="file" multiple className="hidden"
                                    accept={`${ACCEPTED_IMAGE_TYPES},${ACCEPTED_DOC_TYPES}`}
                                    onChange={e => { handleFileSelect(e.target.files); e.target.value = '' }}
                                />
                                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isGenerating}
                                    className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                                    title="附加圖片或文件"
                                >
                                    <Paperclip className="h-5 w-5" />
                                </button>
                            </div>

                            <button type="button" onClick={() => handleSubmit()}
                                disabled={(!input.trim() && attachments.length === 0) || isGenerating}
                                className={`flex items-center justify-center p-2.5 rounded-full transition-all duration-200 
                                    ${(!input.trim() && attachments.length === 0)
                                        ? 'bg-muted/80 text-muted-foreground'
                                        : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transform hover:scale-105 active:scale-95'
                                    } disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none mr-1`}
                            >
                                {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 pl-0.5" />}
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground/50 text-center mt-3 font-medium">AI 助手可能會產生錯誤資訊，請小心查證。</p>
                </div>
            </div>

            {/* Split Sidebar View */}
            {selectedPreviewAttachment && (
                <FilePreviewSidebar
                    attachment={selectedPreviewAttachment}
                    onClose={() => setSelectedPreviewAttachment(null)}
                />
            )}
        </div>
    )
}
