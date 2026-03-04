"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Brain, ChevronDown, ChevronUp, FileText, Loader2, MessageSquare, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
import { MarkdownCode } from "@/components/chat/markdown-code"
import { MarkdownComponents } from "@/components/chat/markdown-components"
import { cn } from "@/lib/utils"

type ChatSessionItem = {
  id: string
  title: string
  updatedAt: string
}

type AttachmentItem = {
  name: string
  mimeType: string
  base64?: string
  previewUrl?: string
}

type ChatMessageItem = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  attachments?: AttachmentItem[]
  createdAt: string
}

function ThinkBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="my-3 flex flex-col gap-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-fit flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
      >
        <Brain className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
        <span>思考過程</span>
        {expanded ? <ChevronUp className="h-3 w-3 opacity-50" /> : <ChevronDown className="h-3 w-3 opacity-50" />}
      </button>
      {expanded && (
        <div className="pl-4 ml-[7px] border-l-2 border-border/60 text-[13px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
          {content.trim()}
        </div>
      )}
    </div>
  )
}

function MessageContent({ content }: { content: string }) {
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
    <div className="flex flex-col gap-3">
      {parts.map((p, i) =>
        p.type === "think" ? (
          <ThinkBlock key={`think-${i}`} content={p.content} />
        ) : (
          <div key={`text-${i}`} className="prose-container relative">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={MarkdownComponents}>
              {p.content}
            </ReactMarkdown>
          </div>
        )
      )}
    </div>
  )
}

function AttachmentThumbnail({ attachment, onClick }: { attachment: AttachmentItem; onClick?: () => void }) {
  const isImage = attachment.mimeType.startsWith("image/")
  const isPdf = attachment.mimeType === "application/pdf"
  const imgSrc = attachment.previewUrl || (attachment.base64 ? `data:${attachment.mimeType};base64,${attachment.base64}` : undefined)

  let ext = "FILE"
  const parts = attachment.name.split(".")
  if (parts.length > 1) ext = parts[parts.length - 1].toUpperCase()

  return (
    <div
      className="group relative h-16 w-16 md:h-20 md:w-20 shrink-0 rounded-2xl border border-border bg-muted overflow-hidden cursor-pointer hover:ring-2 hover:ring-ring transition-all"
      onClick={onClick}
    >
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
    </div>
  )
}

function FilePreviewSidebar({ attachment, onClose }: { attachment: AttachmentItem; onClose: () => void }) {
  const isImage = attachment.mimeType.startsWith("image/")
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
        ) : attachment.mimeType === "application/pdf" ? (
          <iframe src={imgSrc} className="w-full h-full rounded-md border border-border bg-white" title={attachment.name} />
        ) : (
          <div className="text-center p-8 bg-background border border-border shadow-sm rounded-xl max-w-sm">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-sm font-medium mb-1 truncate">{attachment.name}</h3>
            <p className="text-xs text-muted-foreground mb-4">目前支援圖片與 PDF 預覽</p>
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

export function ChatMonitorDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string | null
  userName: string
}) {
  const [sessions, setSessions] = useState<ChatSessionItem[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState<AttachmentItem | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)

  useEffect(() => {
    if (!open || !userId) return
    const controller = new AbortController()
    const load = async () => {
      try {
        setLoadingSessions(true)
        const res = await fetch(`/api/admin/chat/users/${userId}/sessions`, { signal: controller.signal })
        if (!res.ok) throw new Error("failed to fetch sessions")
        const data = (await res.json()) as ChatSessionItem[]
        setSessions(data)
        setSelectedSessionId(data[0]?.id || null)
      } catch {
        setSessions([])
        setSelectedSessionId(null)
      } finally {
        setLoadingSessions(false)
      }
    }
    load()
    return () => controller.abort()
  }, [open, userId])

  useEffect(() => {
    if (!open || !userId || !selectedSessionId) {
      setMessages([])
      return
    }
    const controller = new AbortController()
    const load = async () => {
      try {
        setLoadingMessages(true)
        setSelectedPreviewAttachment(null)
        const res = await fetch(`/api/admin/chat/users/${userId}/sessions/${selectedSessionId}/messages`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error("failed to fetch messages")
        const data = (await res.json()) as ChatMessageItem[]
        setMessages(data)
      } catch {
        setMessages([])
      } finally {
        setLoadingMessages(false)
      }
    }
    load()
    return () => controller.abort()
  }, [open, userId, selectedSessionId])

  useEffect(() => {
    if (!open) setSelectedPreviewAttachment(null)
  }, [open])

  const subtitle = useMemo(() => `${sessions.length} 個對話`, [sessions.length])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] w-[1200px] h-[85vh] p-0 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="px-6 py-4 border-b border-border/60">
            <DialogTitle>{userName} 的聊天監控</DialogTitle>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </DialogHeader>

          <div className="flex-1 min-h-0 grid grid-cols-4">
            <div className="col-span-1 min-h-0 border-r border-border/60 overflow-y-auto bg-muted/20">
              {loadingSessions ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> 載入對話中
                </div>
              ) : sessions.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">此使用者尚無對話</div>
              ) : (
                <div className="p-2 space-y-1">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSessionId(s.id)}
                      className={cn(
                        "w-full text-left rounded-xl px-3 py-2.5 transition-colors border",
                        selectedSessionId === s.id
                          ? "bg-primary/10 border-primary/20 text-primary"
                          : "bg-background border-transparent hover:bg-muted"
                      )}
                    >
                      <p className="text-sm font-medium truncate">{s.title || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(s.updatedAt).toLocaleString("zh-TW")}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="col-span-3 min-h-0 overflow-hidden bg-background">
              {!selectedSessionId ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <MessageSquare className="h-4 w-4 mr-2" /> 請先選擇左側對話
                </div>
              ) : loadingMessages ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> 載入訊息中
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">此對話沒有訊息</div>
              ) : (
                <div className="h-full flex">
                  <div
                    className={`relative flex flex-col h-full transition-all duration-300 ease-in-out ${selectedPreviewAttachment ? "w-1/2 min-w-0 border-r border-border" : "w-full"
                      }`}
                  >
                    <div className="h-full overflow-y-auto">
                      <div className={`mx-auto w-full space-y-8 py-5 ${selectedPreviewAttachment ? "px-6 max-w-full" : "px-5 max-w-4xl"}`}>
                        {messages.map((m) => (
                          <div key={m.id} className={`flex w-full group ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`flex flex-col gap-2 max-w-[90%] ${m.role === "user" ? "items-end" : "items-start w-full"}`}>
                              {m.attachments && m.attachments.length > 0 && (
                                <div className={`flex flex-wrap gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                  {m.attachments.map((att, i) => (
                                    <AttachmentThumbnail
                                      key={`${m.id}-att-${i}`}
                                      attachment={{ ...att, base64: att.base64 || "" }}
                                      onClick={() => setSelectedPreviewAttachment({ ...att, base64: att.base64 || "" })}
                                    />
                                  ))}
                                </div>
                              )}
                              {m.content && (
                                <div
                                  className={cn(
                                    "relative text-[15px] leading-relaxed",
                                    m.role === "user"
                                      ? "bg-muted text-foreground px-5 py-3.5 rounded-[24px] rounded-br-sm"
                                      : m.role === "assistant"
                                        ? "bg-transparent text-foreground py-1 w-full"
                                        : "bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-800/40 px-4 py-2 rounded-2xl"
                                  )}
                                >
                                  {m.role === "assistant" ? (
                                    <MessageContent content={m.content} />
                                  ) : (
                                    <p className="whitespace-pre-wrap">{m.content}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedPreviewAttachment && (
                    <FilePreviewSidebar
                      attachment={selectedPreviewAttachment}
                      onClose={() => setSelectedPreviewAttachment(null)}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
