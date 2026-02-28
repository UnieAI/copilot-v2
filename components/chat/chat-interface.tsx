"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
    Send, Paperclip, X, RefreshCw, Edit2,
    ChevronDown, ChevronUp, Loader2, Check, Settings2,
    Brain, Image as ImageIcon, FileText
} from "lucide-react"
import { toast } from "sonner"

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
function ThinkBlock({ content }: { content: string }) {
    const [expanded, setExpanded] = useState(false)
    return (
        <div className="my-2 rounded-lg border border-border/60 overflow-hidden">
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors text-left"
            >
                <Brain className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                <span className="font-medium">思考過程</span>
                <span className="ml-auto">
                    {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </span>
            </button>
            {expanded && (
                <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground bg-muted/20 border-t border-border/40 whitespace-pre-wrap font-mono leading-relaxed">
                    {content.trim()}
                </div>
            )}
        </div>
    )
}

// Render content with <think>...</think> blocks collapsed
function MessageContent({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
    const parts: { type: 'text' | 'think'; content: string }[] = []
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
        parts.push({ type: 'think', content: remaining.slice(openThink + 7) + (isStreaming ? '▋' : '') })
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
                    ? <ThinkBlock key={i} content={p.content} />
                    : <div key={i} className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-pre:text-xs">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.content}</ReactMarkdown>
                    </div>
            )}
        </div>
    )
}

// ─── Image / File Attachment Chip with Dialog ──────────────────────────
function AttachmentChip({ name, mimeType, base64, previewUrl, onRemove }: {
    name: string
    mimeType: string
    base64?: string
    previewUrl?: string
    onRemove?: () => void
}) {
    const [dialogOpen, setDialogOpen] = useState(false)
    const isImage = mimeType.startsWith('image/')

    const imgSrc = previewUrl || (base64 ? `data:${mimeType};base64,${base64}` : undefined)

    return (
        <>
            <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="flex items-center gap-1.5 bg-muted border border-border rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80 max-w-[160px] group"
            >
                {isImage && imgSrc
                    ? <img src={imgSrc} alt={name} className="h-4 w-4 rounded object-cover" />
                    : isImage
                        ? <ImageIcon className="h-3 w-3 shrink-0" />
                        : <FileText className="h-3 w-3 shrink-0" />
                }
                <span className="truncate flex-1">{name}</span>
                {onRemove && (
                    <span onClick={e => { e.stopPropagation(); onRemove?.() }} className="ml-0.5 hover:text-destructive shrink-0">
                        <X className="h-3 w-3" />
                    </span>
                )}
            </button>

            {dialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDialogOpen(false)}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div className="relative z-10 bg-card rounded-xl border border-border shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <p className="text-sm font-medium truncate">{name}</p>
                            <button onClick={() => setDialogOpen(false)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-4">
                            {isImage && imgSrc
                                ? <img src={imgSrc} alt={name} className="w-full h-auto rounded-lg object-contain max-h-[60vh]" />
                                : <p className="text-sm text-muted-foreground">此附件為 {mimeType} 類型文件，已傳送至 AI 進行分析。</p>
                            }
                        </div>
                    </div>
                </div>
            )}
        </>
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

// ─── Main Chat Interface ─────────────────────────────────────────────────
export function ChatInterface({
    sessionId: initialSessionId,
    availableModels,
    initialMessages = []
}: {
    sessionId?: string
    availableModels: string[]
    initialMessages?: DBMessage[]
}) {
    const router = useRouter()
    const [sessionId, setSessionId] = useState(initialSessionId)
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
    const [selectedModel, setSelectedModel] = useState(availableModels[0] || "")
    const [systemPrompt, setSystemPrompt] = useState("")
    const [showSystemPrompt, setShowSystemPrompt] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [statusText, setStatusText] = useState("")
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState("")
    const [editAttachments, setEditAttachments] = useState<Attachment[]>([])
    const [editKeepAttachments, setEditKeepAttachments] = useState<Attachment[]>([])

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const editFileInputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, statusText])

    useEffect(() => {
        if (availableModels.length > 0 && !selectedModel) {
            setSelectedModel(availableModels[0])
        }
    }, [availableModels])

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
            const res = await fetch("/api/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: conversationHistory,
                    sessionId: sessionId || null,
                    selectedModel,
                    systemPrompt: systemPrompt || null,
                    attachments: allAtts,
                    editMessageId: safeEditId || null,
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
                            setSessionId(ev.data)
                            window.history.pushState({}, '', `/c/${ev.data}`)
                        } else if (ev.type === 'status') {
                            setStatusText(ev.data)
                        } else if (ev.type === 'chunk') {
                            setMessages(prev => prev.map(m =>
                                m.id === aiMsgId ? { ...m, content: m.content + ev.data } : m
                            ))
                        } else if (ev.type === 'error') {
                            toast.error(ev.data)
                        } else if (ev.type === 'title_updated') {
                            window.dispatchEvent(new CustomEvent('sidebar:refresh'))
                        } else if (ev.type === 'done') {
                            aiMsgDbId = ev.data?.messageId
                            userMsgDbId = ev.data?.userMessageId
                            // Unlock UI immediately — don't wait for stream close (title generation)
                            setMessages(prev => prev.map(m => {
                                if (m.id === aiMsgId) return { ...m, isStreaming: false, dbId: aiMsgDbId }
                                if (m.id === tempUserMsgId) return { ...m, dbId: userMsgDbId }
                                return m
                            }))
                            setIsGenerating(false)
                            setStatusText("")
                        }
                    } catch { }
                }
            }
            // Stream fully closed — refresh to sync any server state
            router.refresh()

        } catch (e: any) {
            toast.error("串流連線失敗: " + e.message)
        } finally {
            // Ensure we always clean up even if done event was never received
            setIsGenerating(false)
            setStatusText("")
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
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
    }

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
                <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    className="h-8 rounded-md border border-input bg-transparent px-2 py-1 text-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                >
                    {availableModels.length === 0
                        ? <option value="">未配置模型</option>
                        : availableModels.map(m => <option key={m} value={m}>{m}</option>)
                    }
                </select>
                <button
                    onClick={() => setShowSystemPrompt(v => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                >
                    <Settings2 className="h-4 w-4" />
                    System Prompt
                    {showSystemPrompt ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
            </div>

            {/* System Prompt Panel */}
            {showSystemPrompt && (
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <textarea
                        value={systemPrompt}
                        onChange={e => setSystemPrompt(e.target.value)}
                        placeholder="輸入 System Prompt（留空則不使用）..."
                        rows={3}
                        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
                {messages.length === 0 && !isGenerating && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <Send className="h-5 w-5" />
                        </div>
                        <p className="text-sm">開始一段新的對話</p>
                    </div>
                )}

                {messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col gap-1.5 group ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                            <span className="font-medium">{msg.role === 'user' ? '你' : 'AI'}</span>
                        </div>

                        {/* Attachment chips */}
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 max-w-[80%]">
                                {msg.attachments.map((att, i) => (
                                    <AttachmentChip
                                        key={i}
                                        name={att.name}
                                        mimeType={att.mimeType}
                                        base64={att.base64}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Message bubble or Edit mode */}
                        {editingId === msg.id ? (
                            <div className="w-full max-w-[85%] space-y-2">
                                <textarea
                                    value={editContent}
                                    onChange={e => setEditContent(e.target.value)}
                                    rows={4}
                                    autoFocus
                                    className="w-full resize-none rounded-lg border border-ring bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                {msg.role === 'user' && (
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap gap-1.5">
                                            {editKeepAttachments.map((att, i) => (
                                                <AttachmentChip key={`keep-${i}`} name={att.name} mimeType={att.mimeType}
                                                    base64={att.base64}
                                                    onRemove={() => setEditKeepAttachments(prev => prev.filter((_, j) => j !== i))}
                                                />
                                            ))}
                                            {editAttachments.map((att, i) => (
                                                <AttachmentChip key={`new-${i}`} name={att.name} mimeType={att.mimeType} previewUrl={att.previewUrl}
                                                    onRemove={() => setEditAttachments(prev => prev.filter((_, j) => j !== i))}
                                                />
                                            ))}
                                        </div>
                                        <input type="file" ref={editFileInputRef} className="hidden" multiple
                                            accept={`${ACCEPTED_IMAGE_TYPES},${ACCEPTED_DOC_TYPES}`}
                                            onChange={e => { handleFileSelect(e.target.files, true); e.target.value = '' }}
                                        />
                                        <button type="button" onClick={() => editFileInputRef.current?.click()}
                                            disabled={isGenerating}
                                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Paperclip className="h-3 w-3" /> 附加檔案
                                        </button>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <button onClick={() => commitEdit(msg)}
                                        disabled={isGenerating}
                                        className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Check className="h-3 w-3" />
                                        {msg.role === 'user' ? '儲存並重新生成' : '儲存'}
                                    </button>
                                    <button onClick={cancelEdit}
                                        disabled={isGenerating}
                                        className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        取消
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className={`
                                relative max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed
                                ${msg.role === 'user'
                                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                    : 'bg-muted text-foreground rounded-tl-sm border border-border'
                                }
                            `}>
                                {msg.role === 'assistant'
                                    ? <MessageContent content={msg.content} isStreaming={msg.isStreaming} />
                                    : <p className="whitespace-pre-wrap">{msg.content}</p>
                                }

                                {!msg.isStreaming && (
                                    <div className={`absolute -bottom-7 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'right-0' : 'left-0'}`}>
                                        <button
                                            onClick={() => startEdit(msg)}
                                            disabled={isGenerating}
                                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border rounded px-2 py-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Edit2 className="h-3 w-3" /> 編輯
                                        </button>
                                        {msg.role === 'assistant' && (
                                            <button
                                                onClick={() => handleRegenerate(msg.id)}
                                                disabled={isGenerating}
                                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground bg-background border border-border rounded px-2 py-0.5 disabled:opacity-50"
                                            >
                                                <RefreshCw className="h-3 w-3" /> 重新生成
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                <StatusBadge text={statusText} />
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border bg-background p-4">
                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {attachments.map((att, i) => (
                            <AttachmentChip key={i} name={att.name} mimeType={att.mimeType} previewUrl={att.previewUrl}
                                onRemove={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                            />
                        ))}
                    </div>
                )}
                <div className="flex items-end gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
                    <input ref={fileInputRef} type="file" multiple className="hidden"
                        accept={`${ACCEPTED_IMAGE_TYPES},${ACCEPTED_DOC_TYPES}`}
                        onChange={e => { handleFileSelect(e.target.files); e.target.value = '' }}
                    />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isGenerating}
                        className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                    >
                        <Paperclip className="h-4 w-4" />
                    </button>
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="輸入訊息... (Shift+Enter 換行)"
                        disabled={isGenerating}
                        rows={1}
                        className="flex-1 resize-none bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-[200px] overflow-y-auto"
                    />
                    <button type="button" onClick={() => handleSubmit()}
                        disabled={(!input.trim() && attachments.length === 0) || isGenerating}
                        className="shrink-0 h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors"
                    >
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">支援 JPG、PNG、PDF、DOC、CSV、TXT、MD 附件</p>
            </div>
        </div>
    )
}
