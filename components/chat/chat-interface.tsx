"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import remarkGfm from "remark-gfm"
import ReactMarkdown from "react-markdown"
import {
    Send, Paperclip, X, RefreshCw, Edit2,
    ChevronDown, ChevronUp, Loader2, Check, Settings2,
    Brain, FileText, Bot, User, ChevronsUpDown,
    Search
} from "lucide-react"
import { toast } from "sonner"
import { streamStore } from "@/lib/stream-store"
import { useTranslations } from "next-intl"
import { DynamicGreeting } from "@/components/ui/dynamic-greeting"
import { MarkdownCode } from "@/components/chat/markdown-code"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
const ACCEPTED_DOC_TYPES = ".pdf,.doc,.docx,.csv,.txt,.md,.json,.js,.jsx,.ts,.tsx,.html,.css,.py"

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
    })
}

// ─── Model Item Component ─────────────────────────────────────────────
const ModelItem = ({
    model,
    isSelected,
    onSelect
}: {
    model: any;
    isSelected: boolean;
    onSelect: (value: string) => void
}) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <DropdownMenuItem
            onSelect={() => onSelect(model.value)}
            asChild // 關鍵：讓 DropdownMenuItem 渲染成你自定義的按鈕樣式
        >
            <button
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-all text-left group outline-none ${isSelected
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted/60 text-foreground/90 hover:text-foreground"
                    }`}
            >
                <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="text-sm truncate leading-tight">{model.label}</span>
                    <span className={`text-[10px] font-medium uppercase tracking-wider leading-tight ${isSelected
                        ? "text-primary/80"
                        : "text-muted-foreground group-hover:text-muted-foreground/80"
                        }`}>
                        {model.providerName}
                    </span>
                </div>
                {isSelected ? (
                    <Check className="h-4 w-4 opacity-100 shrink-0" />
                ) : (
                    // <ChevronsUpDown className={`h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${isHovered ? "opacity-100" : ""
                    //     }`} />
                    <></>
                )}
            </button>
        </DropdownMenuItem>
    );
};

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
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{ code: MarkdownCode }}
                        >
                            {p.content}
                        </ReactMarkdown>
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
    source?: 'user' | 'group'
    groupId?: string
    groupName?: string
}

// ─── Group Model Section (2nd-level collapsible) ──────────────────────────
function GroupModelSection({
    groupName,
    models,
    selectedModel,
    hasSelected,
    onSelect,
    showSeparator,
}: {
    groupName: string
    models: AvailableModel[]
    selectedModel: string
    hasSelected: boolean
    onSelect: (value: string) => void
    showSeparator: boolean
}) {
    const [expanded, setExpanded] = useState(hasSelected) // auto-expand if a model from this group is selected

    return (
        <>
            {showSeparator && <div className="my-1 border-t border-border/40" />}
            {/* Group header row */}
            <button
                onClick={() => setExpanded(v => !v)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/60
                    ${hasSelected ? 'text-primary' : 'text-foreground/80'}`}
            >
                <span className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">群組</span>
                    <span>{groupName}</span>
                    {hasSelected && <span className="text-[10px] text-primary">✓ 使用中</span>}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Expanded model list */}
            {expanded && (
                <div className="bg-muted/20">
                    {models.map(m => (
                        <button
                            key={m.value}
                            onClick={() => onSelect(m.value)}
                            className={`w-full text-left pl-7 pr-4 py-2 text-sm transition-colors flex items-center justify-between
                                ${selectedModel === m.value ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground/80 hover:text-foreground'}
                            `}
                        >
                            <div className="flex flex-col items-start">
                                <span className="truncate max-w-[160px]">{m.label}</span>
                                <span className="text-[10px] text-muted-foreground">{m.providerName}</span>
                            </div>
                            {selectedModel === m.value && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                    ))}
                </div>
            )}
        </>
    )
}

// ─── Main Chat Interface ─────────────────────────────────────────────────
export function ChatInterface({
    sessionId: initialSessionId,
    availableModels,
    initialSelectedModel,
    initialQuery,
    initialMessages = [],
    projectId,
    onSessionCreated,
}: {
    sessionId?: string
    availableModels: AvailableModel[]
    initialSelectedModel?: string
    initialQuery?: string
    initialMessages?: DBMessage[]
    projectId?: string          // if set, new sessions are placed in this project
    onSessionCreated?: (id: string, title: string) => void  // called when a new session is created
}) {
    const router = useRouter()
    const t = useTranslations('Home')
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
    const [isDragging, setIsDragging] = useState(false)
    const [modelSearch, setModelSearch] = useState("")

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const editFileInputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const hasFiredInitialQuery = useRef(false)

    // Scroll state — mirrors the pattern from step2.tsx
    const [isAutoScrolling, setIsAutoScrolling] = useState(true)
    const [showScrollButton, setShowScrollButton] = useState(false)

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

            setShowScrollButton(computedVisible ? false : !isAtBottom)
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
    }, [messages, statusText])

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
            newAtts.push({
                name: file.name,
                mimeType,
                base64,
                previewUrl: mimeType.startsWith('image/') ? URL.createObjectURL(file) : undefined
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

    const [modelPickerOpen, setModelPickerOpen] = useState(false)
    // Derived: selected model display label
    const selectedModelObj = availableModels.find(m => m.value === selectedModel)
    const selectedModelLabel = selectedModelObj ? `${selectedModelObj.label}` : (selectedModel || "未選擇模型")

    // Called when user picks a model from the dropdown
    const handleModelChange = (modelValue: string) => {
        setSelectedModel(modelValue)
        setModelPickerOpen(false)

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

    // Model picker filtering
    const searchTerm = modelSearch.trim().toLowerCase()
    const matchesSearch = (text?: string) => text?.toLowerCase().includes(searchTerm)

    const userModels = availableModels.filter(m => !m.source || m.source === 'user')
    const filteredUserModels = searchTerm
        ? userModels.filter(m =>
            matchesSearch(m.label) ||
            matchesSearch(m.providerName)
        )
        : userModels

    const groupModels = availableModels.filter(m => m.source === 'group')
    const groupMap = new Map<string, AvailableModel[]>()
    groupModels.forEach(m => {
        const name = m.groupName || '群組'
        if (!groupMap.has(name)) groupMap.set(name, [])
        groupMap.get(name)!.push(m)
    })
    const groupEntries = [...groupMap.entries()].map(([gName, gModels]) => {
        const filtered = searchTerm
            ? gModels.filter(m =>
                matchesSearch(m.label) ||
                matchesSearch(m.providerName) ||
                matchesSearch(gName)
            )
            : gModels
        return { gName, filtered, total: gModels.length }
    }).filter(({ filtered, gName }) => filtered.length > 0 || matchesSearch(gName))
    const hasAnyMatch = filteredUserModels.length > 0 || groupEntries.length > 0

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

                    {/* Dropdown model selector with hoverable submenus */}
                    {/* <DropdownMenu
                        open={modelPickerOpen}
                        onOpenChange={(open) => {
                            setModelPickerOpen(open)
                            if (!open) setModelSearch("")
                        }}
                    >
                        <DropdownMenuTrigger asChild>
                            <button
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
                                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" sideOffset={8} className="w-80 p-0 max-h-[440px] overflow-y-auto">
                            <div className="px-3 py-2 border-b border-border/60">
                                <input
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    placeholder="搜尋模型..."
                                    value={modelSearch}
                                    onChange={(e) => setModelSearch(e.target.value)}
                                />
                            </div>

                            {filteredUserModels.length > 0 && (
                                <DropdownMenuGroup className="py-1">
                                    {filteredUserModels.map(m => (
                                        <DropdownMenuItem
                                            key={m.value}
                                            onSelect={() => { handleModelChange(m.value); setModelPickerOpen(false) }}
                                            className="flex items-center justify-between gap-2"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm">{m.label}</span>
                                                <span className="text-[10px] text-muted-foreground">{m.providerName}</span>
                                            </div>
                                            {selectedModel === m.value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuGroup>
                            )}

                            {filteredUserModels.length > 0 && groupEntries.length > 0 && <DropdownMenuSeparator />}

                            {groupEntries.length > 0 && (
                                <DropdownMenuGroup className="max-h-[320px] overflow-y-auto py-1">
                                    {groupEntries.map(({ gName, filtered, total }) => (
                                        <DropdownMenuSub key={gName}>
                                            <DropdownMenuSubTrigger className="flex items-center justify-between gap-3">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{gName}</span>
                                                    <span className="text-[10px] text-muted-foreground">{filtered.length} / {total} 模型</span>
                                                </div>
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuPortal>
                                                <DropdownMenuSubContent className="w-64 rounded-lg">
                                                    {filtered.length > 0 ? filtered.map(m => (
                                                        <DropdownMenuItem
                                                            key={m.value}
                                                            onSelect={() => { handleModelChange(m.value); setModelPickerOpen(false) }}
                                                            className="flex items-center justify-between gap-2"
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="text-sm">{m.label}</span>
                                                                <span className="text-[10px] text-muted-foreground">{m.providerName}</span>
                                                            </div>
                                                            {selectedModel === m.value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                                        </DropdownMenuItem>
                                                    )) : (
                                                        <div className="px-3 py-2 text-xs text-muted-foreground">此群組無符合的模型</div>
                                                    )}
                                                </DropdownMenuSubContent>
                                            </DropdownMenuPortal>
                                        </DropdownMenuSub>
                                    ))}
                                </DropdownMenuGroup>
                            )}

                            {!hasAnyMatch && (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                    找不到符合的模型
                                </div>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu> */}
                    <DropdownMenu
                        open={modelPickerOpen}
                        onOpenChange={(open) => {
                            setModelPickerOpen(open);
                            if (!open) setModelSearch("");
                        }}
                    >
                        {/* --- 觸發按鈕 (Gemini Style) --- */}
                        <DropdownMenuTrigger asChild>
                            <button className="
            flex items-center justify-between gap-3 px-4 py-2 
            min-w-[160px] max-w-[240px] 
            rounded-full border border-border/40 
            bg-background/50 hover:bg-muted/50 
            transition-all duration-300 group outline-none
        ">
                                <div className="flex flex-col items-start text-left overflow-hidden">
                                    <span className="text-[13px] font-semibold text-foreground/90 group-hover:text-primary truncate w-full transition-colors leading-tight">
                                        {selectedModelLabel}
                                    </span>
                                    {selectedModelObj && (
                                        <span className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-widest truncate w-full">
                                            {selectedModelObj.providerName}
                                        </span>
                                    )}
                                </div>
                                <ChevronDown className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-all duration-300 group-data-[state=open]:rotate-180" />
                            </button>
                        </DropdownMenuTrigger>

                        {/* --- 下拉內容 (Gemini Style) --- */}
                        <DropdownMenuContent
                            align="start"
                            sideOffset={10}
                            className="
            w-80 p-2 
            rounded-[24px] border-border/40 
            bg-background/80 backdrop-blur-2xl 
            shadow-[0_8px_32px_rgba(0,0,0,0.12)] 
            animate-in fade-in zoom-in-95 duration-200
        "
                        >
                            {/* 搜尋框區塊：更簡潔的底色 */}
                            <div className="relative mb-2 px-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                                <input
                                    autoFocus
                                    className="
                    w-full pl-10 pr-4 py-2.5 text-sm 
                    bg-muted/30 hover:bg-muted/50 focus:bg-background 
                    rounded-2xl border-none ring-1 ring-border/20 
                    focus:ring-2 focus:ring-primary/30 
                    outline-none transition-all
                "
                                    placeholder="搜尋 AI 模型..."
                                    value={modelSearch}
                                    onChange={(e) => setModelSearch(e.target.value)}
                                />
                            </div>

                            <div className="max-h-[420px] overflow-y-auto px-1 custom-scrollbar">
                                {/* 最近使用 */}
                                {filteredUserModels.length > 0 && (
                                    <DropdownMenuGroup>
                                        <div className="px-3 py-2 text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">
                                            MY MODELS
                                        </div>
                                        <div className="space-y-0.5">
                                            {filteredUserModels.map(m => (
                                                <ModelItem
                                                    key={m.value}
                                                    model={m}
                                                    isSelected={selectedModel === m.value}
                                                    onSelect={(val) => {
                                                        handleModelChange(val);
                                                        setModelPickerOpen(false);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </DropdownMenuGroup>
                                )}

                                {/* 分隔線：更淡的處理 */}
                                {filteredUserModels.length > 0 && groupEntries.length > 0 && (
                                    <DropdownMenuSeparator className="my-2 bg-border/30 mx-2" />
                                )}

                                {/* 模型群組 */}
                                {groupEntries.length > 0 && (
                                    <DropdownMenuGroup>
                                        <div className="px-3 py-2 text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">
                                            GROUPS
                                        </div>
                                        <div className="space-y-0.5">
                                            {groupEntries.map(({ gName, filtered, total }) => (
                                                <DropdownMenuSub key={gName}>
                                                    <DropdownMenuSubTrigger className="
                                    rounded-xl py-2.5 px-3 
                                    hover:bg-muted/50 focus:bg-muted/50 
                                    data-[state=open]:bg-muted/50
                                    transition-colors cursor-pointer
                                ">
                                                        <div className="flex flex-col gap-0.5 text-left">
                                                            <span className="text-[13px] font-medium">{gName}</span>
                                                            <span className="text-[10px] text-muted-foreground/60">{filtered.length} Models</span>
                                                        </div>
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuPortal>
                                                        <DropdownMenuSubContent
                                                            sideOffset={8}
                                                            className="
                                            w-64 p-2 rounded-[20px] 
                                            bg-background/90 backdrop-blur-xl 
                                            shadow-xl border-border/40
                                        "
                                                        >
                                                            <div className="max-h-[300px] overflow-y-auto space-y-0.5">
                                                                {filtered.map(m => (
                                                                    <ModelItem
                                                                        key={m.value}
                                                                        model={m}
                                                                        isSelected={selectedModel === m.value}
                                                                        onSelect={(val) => {
                                                                            handleModelChange(val);
                                                                            setModelPickerOpen(false);
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuPortal>
                                                </DropdownMenuSub>
                                            ))}
                                        </div>
                                    </DropdownMenuGroup>
                                )}

                                {/* 空狀態 */}
                                {!hasAnyMatch && (
                                    <div className="py-16 text-center animate-in fade-in slide-in-from-bottom-2">
                                        <div className="inline-flex p-3 rounded-full bg-muted/30 mb-3">
                                            <Search className="h-5 w-5 text-muted-foreground/30" />
                                        </div>
                                        <p className="text-xs text-muted-foreground font-medium">找不到相關模型</p>
                                    </div>
                                )}
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

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
                    className="flex-1 overflow-y-auto w-full relative [scrollbar-color:auto_transparent] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:bg-transparent"
                >
                    <div className={`mx-auto w-full space-y-8 py-8 ${selectedPreviewAttachment ? 'px-6 max-w-full' : 'px-4 max-w-3xl'}`}>
                        {messages.length === 0 && !isGenerating && (
                            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] gap-4 text-muted-foreground">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                    <Brain className="h-8 w-8 text-muted-foreground/50" />
                                </div>
                                <p className="text-sm font-medium flex items-center gap-1">
                                    <DynamicGreeting className="inline-block" />, {t('subtitle')}
                                </p>
                            </div>
                        )}

                        {messages.map((msg, index) => (
                            <div key={msg.id} className={`flex w-full group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                                {/* Assistant Avatar */}
                                {/* {msg.role === 'assistant' && (
                                    <div className="flex-shrink-0 mr-4 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mt-1 outline outline-1 outline-border">
                                        <Bot className="h-5 w-5 text-primary" />
                                    </div>
                                )} */}

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
                                onClick={() => {
                                    // One-shot smooth scroll to bottom, then re-enable rAF auto-scroll
                                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
                                    setTimeout(() => setIsAutoScrolling(true), 500)
                                }}
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
                            className={`w-full resize-none bg-transparent px-5 py-4 text-[15px] leading-relaxed focus:outline-none placeholder:text-muted-foreground disabled:opacity-50 min-h-[56px] max-h-[30vh] overflow-y-auto scrollbar-hide ${attachments.length > 0 ? 'pt-3' : ''}`}
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
