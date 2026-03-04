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

function base64ToBlobUrl(base64: string, mimeType: string): string {
    const bin = atob(base64)
    const len = bin.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }))
}

function useAttachmentPreviewSrc(attachment: Attachment): string | undefined {
    const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined)

    useEffect(() => {
        if (attachment.previewUrl) {
            setBlobUrl(undefined)
            return
        }
        if (!attachment.base64 || attachment.mimeType !== 'application/pdf') {
            setBlobUrl(undefined)
            return
        }

        let url: string | undefined
        try {
            url = base64ToBlobUrl(attachment.base64, attachment.mimeType)
            setBlobUrl(url)
        } catch {
            setBlobUrl(undefined)
        }

        return () => {
            if (url) URL.revokeObjectURL(url)
        }
    }, [attachment.base64, attachment.mimeType, attachment.previewUrl])

    if (attachment.previewUrl) return attachment.previewUrl
    if (blobUrl) return blobUrl
    if (attachment.base64) return `data:${attachment.mimeType};base64,${attachment.base64}`
    return undefined
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

// ─── Gemini Style Markdown Components ────────────────────────────────
export const MarkdownComponents: any = {
    // 標題：稍微加粗，帶有層次感
    h1: ({ children }: any) => <h1 className="text-xl font-bold mt-6 mb-2 text-foreground">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-lg font-semibold mt-5 mb-2 text-foreground/90">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-base font-semibold mt-4 mb-1 text-foreground/80">{children}</h3>,

    // 段落：增加行高，讓閱讀不吃力
    p: ({ children }: any) => <p className="leading-7 mb-4 last:mb-0 text-foreground/90">{children}</p>,

    // 清單：Gemini 風格的間距
    ul: ({ children }: any) => <ul className="list-disc pl-6 mb-4 space-y-2 text-foreground/90">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-foreground/90">{children}</ol>,
    li: ({ children }: any) => <li className="leading-7">{children}</li>,

    // 引用：左側紫色/藍色漸層條
    blockquote: ({ children }: any) => (
        <blockquote className="border-l-4 border-primary/30 pl-4 py-1 my-4 italic bg-primary/5 rounded-r-lg text-muted-foreground">
            {children}
        </blockquote>
    ),

    // 表格：這是最難搞的部分，幫你做成 Gemini 的簡潔風
    table: ({ children }: any) => (
        <div className="my-6 overflow-x-auto rounded-xl border border-border/40 shadow-sm">
            <table className="w-full border-collapse text-sm text-left">
                {children}
            </table>
        </div>
    ),
    thead: ({ children }: any) => <thead className="bg-muted/50 border-b border-border/40">{children}</thead>,
    th: ({ children }: any) => <th className="px-4 py-3 font-semibold text-foreground/80">{children}</th>,
    td: ({ children }: any) => <td className="px-4 py-3 border-b border-border/20 last:border-0">{children}</td>,

    // 連結
    a: ({ href, children }: any) => {
        // 判斷是否為 YouTube 連結
        const isYouTube = href && (
            href.includes('youtube.com/watch') ||
            href.includes('youtu.be/')
        );

        if (isYouTube) {
            // 從各種常見 YouTube URL 格式提取 video ID
            let videoId = '';

            // 標準格式：https://www.youtube.com/watch?v=VIDEO_ID
            const url = new URL(href);
            if (url.hostname.includes('youtube.com')) {
                videoId = url.searchParams.get('v') || '';
            }
            // 短網址：https://youtu.be/VIDEO_ID
            else if (url.hostname === 'youtu.be') {
                videoId = url.pathname.slice(1);
            }

            if (videoId) {
                // 保留 ?si=... 或其他參數（可選）
                const embedUrl = `https://www.youtube.com/embed/${videoId}${url.search ? url.search : ''}`;

                return (
                    <div className="my-4 aspect-video w-full max-w-3xl mx-auto rounded-xl overflow-hidden border border-border shadow-sm">
                        <iframe
                            width="100%"
                            height="100%"
                            src={embedUrl}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                        ></iframe>
                    </div>
                );
            }
        }

        // 不是 YouTube 就照原樣渲染一般連結
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium underline underline-offset-4 hover:text-primary/80 transition-colors"
            >
                {children}
            </a>
        );
    },

    // 行內程式碼：淡色背景與圓角
    code: ({ node, inline, className, children, ...props }: any) => {
        // 核心邏輯：將內容轉為字串並檢查是否有換行符
        const content = String(children).replace(/\n$/, "");
        const hasNewline = content.includes("\n");
        const language = className?.replace(/language-/, "");

        // 如果沒有換行符，且不是明確的語言標籤開頭，則判定為 Inline Code
        if (!hasNewline && !language) {
            return (
                <code
                    className="
                        mx-1 rounded-md px-1.5 py-0.5 
                        bg-muted/80 dark:bg-white/10 
                        text-primary dark:text-primary-foreground 
                        font-mono text-[0.85em] font-bold
                        border border-border/40
                        break-all
                    "
                    {...props}
                >
                    {content}
                </code>
            );
        }

        // 否則，渲染為整塊的代碼卡片 (Block Code)
        return (
            <MarkdownCode
                className={className}
                language={language}
                codeText={content}
                {...props}
            />
        );
    }
};

function MessageContent({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
    // 使用 useMemo 解析內容，確保只有內容變動時才重新計算 parts
    const parts = useMemo(() => {
        const res: { type: 'text' | 'think'; content: string; unfinished?: boolean }[] = [];
        let buffer = content;
        let inThink = false;
        let thinkStartIndex = -1;

        // 先找第一個 <think> 或 </think>
        const firstThinkOpen = buffer.indexOf('<think>');
        const firstThinkClose = buffer.indexOf('</think>');

        if (firstThinkOpen === -1 && firstThinkClose === -1) {
            // 完全沒有 think 標籤 → 全當 text
            res.push({ type: 'text', content: buffer });
            return res;
        }

        // 情況1：有 <think> 開頭 → 走原本邏輯（已能處理）
        if (firstThinkOpen !== -1 && (firstThinkOpen < firstThinkClose || firstThinkClose === -1)) {
            // 使用原本的 regex 方式處理多個成對的 <think>...</think>
            const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
            let lastIndex = 0;
            let match;

            while ((match = thinkRegex.exec(buffer)) !== null) {
                if (match.index > lastIndex) {
                    res.push({ type: 'text', content: buffer.slice(lastIndex, match.index) });
                }
                res.push({ type: 'think', content: match[1] });
                lastIndex = match.index + match[0].length;
            }

            const remaining = buffer.slice(lastIndex);
            const openThinkIndex = remaining.indexOf('<think>');

            if (openThinkIndex !== -1) {
                if (openThinkIndex > 0) {
                    res.push({ type: 'text', content: remaining.slice(0, openThinkIndex) });
                }
                res.push({
                    type: 'think',
                    content: remaining.slice(openThinkIndex + 7),
                    unfinished: true,
                });
            } else if (remaining) {
                res.push({ type: 'text', content: remaining });
            }

            return res;
        }

        // 情況2：沒有 <think> 但有 </think> → 把 </think> 之前全部當 think
        if (firstThinkOpen === -1 && firstThinkClose !== -1) {
            const thinkContent = buffer.slice(0, firstThinkClose);
            const afterThink = buffer.slice(firstThinkClose + 8); // 跳過 </think>

            if (thinkContent.trim()) {
                res.push({ type: 'think', content: thinkContent });
            }

            if (afterThink.trim()) {
                res.push({ type: 'text', content: afterThink });
            }

            return res;
        }

        // 其他混合情況（理論上已被上面兩個分支涵蓋，但保留防呆）
        res.push({ type: 'text', content: buffer });
        return res;
    }, [content]);

    return (
        <div className="flex flex-col gap-3 overflow-anchor-auto min-h-[1.5em]">
            {parts.map((p, i) => {
                const isLast = i === parts.length - 1;
                return (
                    <div
                        key={`${p.type}-${i}`}
                        className={cn(
                            "transition-opacity duration-300",
                            isStreaming && isLast ? "opacity-100" : "opacity-100"
                        )}
                    >
                        {p.type === 'think' ? (
                            <ThinkBlock content={p.content} isStreaming={p.unfinished && isStreaming} />
                        ) : (
                            <div className="prose-container relative">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                    components={MarkdownComponents}
                                >
                                    {p.content}
                                </ReactMarkdown>
                                {/* 流式游標 (Gemini Style) */}
                                {isStreaming && isLast && (
                                    <span className="inline-block w-1.5 h-4 ml-1 bg-primary/60 rounded-full animate-pulse vertical-middle" />
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Image / File Attachment Thumbnail ───────────────────────────────────
function AttachmentThumbnail({ attachment, onRemove, onClick }: {
    attachment: Attachment
    onRemove?: () => void
    onClick?: () => void
}) {
    const isImage = attachment.mimeType.startsWith('image/')
    const isPdf = attachment.mimeType === 'application/pdf'
    const imgSrc = useAttachmentPreviewSrc(attachment)

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
            ) : isPdf && imgSrc ? (
                <div className="w-full h-full relative bg-white overflow-hidden">
                    <iframe
                        src={`${imgSrc}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                        className="w-full h-full border-0 pointer-events-none"
                        scrolling="no"
                        aria-hidden
                    />
                    <span className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] font-semibold text-white">PDF</span>
                </div>
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
    const imgSrc = useAttachmentPreviewSrc(attachment)

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
    source?: 'user' | 'group' | 'global'
    groupId?: string
    groupName?: string
}

// ─── Main Chat Interface ─────────────────────────────────────────────────
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
    const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt ?? "")
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
                .catch(() => { })
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

                // 這裡可以再過濾只接受 jpg/png/jpeg 等
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
        agentFetch("/api/agent/providers/clear", { method: "POST" }).catch(() => { })
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
