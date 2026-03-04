"use client"

import { type Dispatch, type RefObject, type SetStateAction } from "react"
import { Check, Edit2, Paperclip, RefreshCw } from "lucide-react"
import type { AgentPart } from "@/lib/agent/types"
import type { Attachment, UIMessage } from "@/components/chat/types"
import { ACCEPTED_DOC_TYPES, ACCEPTED_IMAGE_TYPES } from "@/components/chat/utils"
import { AttachmentThumbnail } from "@/components/chat/attachment-thumbnail"
import { MessageContent } from "@/components/chat/markdown-components"
import { AgentProgressTicker } from "@/components/agent/agent-progress-ticker"
import { AgentPartsRenderer } from "@/components/agent/agent-parts-renderer"
import { AgentToolInlineItem } from "@/components/chat/agent-components"

type ChatMode = "normal" | "agent"

export function ChatMessageItem({
  msg,
  chatMode,
  localePrefix,
  editingId,
  editContent,
  onEditContentChange,
  editKeepAttachments,
  setEditKeepAttachments,
  editAttachments,
  setEditAttachments,
  editFileInputRef,
  onHandleFileSelect,
  isGenerating,
  onCancelEdit,
  onCommitEdit,
  onStartEdit,
  onRegenerate,
  onOpenAttachmentPreview,
  getAgentPartsForMessage,
  onOpenSubAgent,
}: {
  msg: UIMessage
  chatMode: ChatMode
  localePrefix: string
  editingId: string | null
  editContent: string
  onEditContentChange: (value: string) => void
  editKeepAttachments: Attachment[]
  setEditKeepAttachments: Dispatch<SetStateAction<Attachment[]>>
  editAttachments: Attachment[]
  setEditAttachments: Dispatch<SetStateAction<Attachment[]>>
  editFileInputRef: RefObject<HTMLInputElement>
  onHandleFileSelect: (files: FileList | null, isEdit?: boolean) => void
  isGenerating: boolean
  onCancelEdit: () => void
  onCommitEdit: (msg: UIMessage) => void
  onStartEdit: (msg: UIMessage) => void
  onRegenerate: (messageId: string) => void
  onOpenAttachmentPreview: (attachment: Attachment) => void
  getAgentPartsForMessage: (messageId: string) => AgentPart[]
  onOpenSubAgent: (sessionId: string) => void
}) {
  return (
    <div className={`flex w-full group ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start w-full"}`}>
        {editingId === msg.id ? (
          <div className="w-full space-y-3 bg-card p-4 rounded-xl border border-border shadow-sm">
            <textarea
              value={editContent}
              onChange={(e) => onEditContentChange(e.target.value)}
              rows={4}
              autoFocus
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
            />
            {msg.role === "user" && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {editKeepAttachments.map((att, i) => (
                    <AttachmentThumbnail
                      key={`keep-${i}`}
                      attachment={att}
                      onRemove={() => setEditKeepAttachments((prev) => prev.filter((_, j) => j !== i))}
                      onClick={() => onOpenAttachmentPreview(att)}
                    />
                  ))}
                  {editAttachments.map((att, i) => (
                    <AttachmentThumbnail
                      key={`new-${i}`}
                      attachment={att}
                      onRemove={() => setEditAttachments((prev) => prev.filter((_, j) => j !== i))}
                      onClick={() => onOpenAttachmentPreview(att)}
                    />
                  ))}
                </div>
                <input
                  type="file"
                  ref={editFileInputRef}
                  className="hidden"
                  multiple
                  accept={`${ACCEPTED_IMAGE_TYPES},${ACCEPTED_DOC_TYPES}`}
                  onChange={(e) => {
                    onHandleFileSelect(e.target.files, true)
                    e.target.value = ""
                  }}
                />
                <button
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed bg-muted px-3 py-1.5 rounded-md"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  附加檔案
                </button>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={onCancelEdit}
                disabled={isGenerating}
                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                onClick={() => onCommitEdit(msg)}
                disabled={isGenerating}
                className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-3.5 w-3.5" />
                {msg.role === "user" ? "儲存並重新生成" : "儲存"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {msg.attachments && msg.attachments.length > 0 && (
              <div className={`flex flex-wrap gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.attachments.map((att, i) => (
                  <AttachmentThumbnail
                    key={i}
                    attachment={{ ...att, base64: att.base64 || "" }}
                    onClick={() => onOpenAttachmentPreview({ ...att, base64: att.base64 || "" })}
                  />
                ))}
              </div>
            )}

            {(msg.content || (msg.agentToolCalls && msg.agentToolCalls.length > 0) || (chatMode === "agent" && msg.role === "assistant" && Boolean(msg.isStreaming))) && (
              <div
                className={`
                  relative text-[15px] leading-relaxed
                  ${msg.role === "user" ? "bg-muted text-foreground px-5 py-3.5 rounded-[24px] rounded-br-sm" : "bg-transparent text-foreground py-1 w-full"}
                `}
              >
                {chatMode === "agent" && msg.role === "assistant" ? (
                  (() => {
                    const parts = getAgentPartsForMessage(msg.id)
                    if (parts.length === 0 && msg.content) {
                      return (
                        <div className="space-y-2">
                          <MessageContent content={msg.content} isStreaming={msg.isStreaming} animateDuringStreaming />
                          {msg.isStreaming && <AgentProgressTicker />}
                        </div>
                      )
                    }
                    if (parts.length === 0) {
                      return msg.isStreaming ? <AgentProgressTicker /> : null
                    }
                    return (
                      <AgentPartsRenderer
                        parts={parts}
                        isBusy={Boolean(msg.isStreaming)}
                        localePrefix={localePrefix}
                        onOpenSubAgent={onOpenSubAgent}
                      />
                    )
                  })()
                ) : (
                  <>
                    {msg.content && (
                      msg.role === "assistant" ? (
                        <MessageContent
                          content={msg.content}
                          isStreaming={msg.isStreaming}
                          useTextGenerateEffect={chatMode === "agent"}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )
                    )}
                  </>
                )}

                {chatMode !== "agent" && msg.role === "assistant" && msg.agentToolCalls && msg.agentToolCalls.length > 0 && (
                  <div className="mt-2 ml-1 space-y-0.5">
                    {msg.agentToolCalls.map((call, idx) => (
                      <AgentToolInlineItem
                        key={`${msg.id}-inline-tool-${call.id}-${idx}`}
                        call={call}
                        localePrefix={localePrefix}
                      />
                    ))}
                  </div>
                )}

                {!msg.isStreaming && (
                  <div className={`absolute -bottom-9 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "right-0" : "-left-2"}`}>
                    {chatMode === "normal" && (
                      <button
                        onClick={() => onStartEdit(msg)}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted bg-background/50 backdrop-blur-sm border border-transparent hover:border-border transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        title="編輯"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {msg.role === "assistant" && (
                      <button
                        onClick={() => onRegenerate(msg.id)}
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
  )
}
