"use client"

import type { Dispatch, RefObject, SetStateAction } from "react"
import { Bot, ChevronDown, Loader2 } from "lucide-react"
import type { AgentPart, PermissionRequest as PermReq, QuestionRequest as QReq } from "@/lib/agent/types"
import type { Attachment, UIMessage } from "@/components/chat/types"
import { DynamicGreeting } from "@/components/ui/dynamic-greeting"
import { AgentProgressTicker } from "@/components/agent/agent-progress-ticker"
import { AgentPermissionCard, AgentQuestionCard, StatusBadge } from "@/components/chat/agent-components"
import { ChatMessageItem } from "@/components/chat/chat-message-item"

export function ChatMessagesPanel({
  scrollContainerRef,
  messagesEndRef,
  hasRightPanel,
  chatMode,
  localePrefix,
  messages,
  agentUIMessages,
  isGenerating,
  agentSessionId,
  greetingSubtitle,
  statusText,
  showScrollButton,
  onScrollToBottom,
  editingId,
  editContent,
  onEditContentChange,
  editKeepAttachments,
  setEditKeepAttachments,
  editAttachments,
  setEditAttachments,
  editFileInputRef,
  onHandleFileSelect,
  onCancelEdit,
  onCommitEdit,
  onStartEdit,
  onRegenerate,
  onOpenAttachmentPreview,
  getAgentPartsForMessage,
  onOpenSubAgent,
  permissions,
  questions,
  isSyncingModels,
}: {
  scrollContainerRef: RefObject<HTMLDivElement>
  messagesEndRef: RefObject<HTMLDivElement>
  hasRightPanel: boolean
  chatMode: "normal" | "agent"
  localePrefix: string
  messages: UIMessage[]
  agentUIMessages: UIMessage[]
  isGenerating: boolean
  agentSessionId?: string
  greetingSubtitle: string
  statusText: string
  showScrollButton: boolean
  onScrollToBottom: () => void
  editingId: string | null
  editContent: string
  onEditContentChange: (value: string) => void
  editKeepAttachments: Attachment[]
  setEditKeepAttachments: Dispatch<SetStateAction<Attachment[]>>
  editAttachments: Attachment[]
  setEditAttachments: Dispatch<SetStateAction<Attachment[]>>
  editFileInputRef: RefObject<HTMLInputElement>
  onHandleFileSelect: (files: FileList | null, isEdit?: boolean) => void
  onCancelEdit: () => void
  onCommitEdit: (msg: UIMessage) => void
  onStartEdit: (msg: UIMessage) => void
  onRegenerate: (messageId: string) => void
  onOpenAttachmentPreview: (attachment: Attachment) => void
  getAgentPartsForMessage: (messageId: string) => AgentPart[]
  onOpenSubAgent: (sessionId: string) => void
  permissions: PermReq[]
  questions: QReq[]
  isSyncingModels?: boolean
}) {
  const visibleMessages = chatMode === "agent" ? agentUIMessages : messages
  const showEmptyState = visibleMessages.length === 0 && !isGenerating

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto w-full relative [scrollbar-color:auto_transparent] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:bg-transparent"
    >
      {/* Model sync banner — visible when entering agent mode and syncing providers */}
      {isSyncingModels && chatMode === "agent" && (
        <div className="sticky top-0 z-20 w-full animate-in slide-in-from-top-2 duration-300">
          <div className="mx-auto max-w-3xl px-4 pt-3">
            <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 backdrop-blur-sm shadow-sm">
              <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary/10">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight">正在同步模型設定</p>
                <p className="text-xs text-muted-foreground mt-0.5">將您的 API Provider 同步到 Agent 引擎，請稍候...</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        </div>
      )}
      <div className={`mx-auto w-full space-y-8 py-8 ${hasRightPanel ? "px-6 max-w-full" : "px-4 max-w-3xl"}`}>
        {showEmptyState && (
          chatMode === "agent" && !agentSessionId ? (
            <div className="flex flex-col items-center justify-center min-h-[30vh] text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="mt-40 mb-4 rounded-2xl border border-border/60 bg-muted/30 p-3">
                <Bot className="h-6 w-6 text-muted-foreground" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight mb-2 text-foreground">
                Agent mode
              </h1>
              <p className="text-base text-muted-foreground max-w-md leading-relaxed">
                分派一項任務或提問任何問題
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[30vh] text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <h1 className="mt-52 text-4xl font-semibold tracking-tight mb-3 bg-gradient-to-r from-foreground via-foreground/80 to-muted-foreground bg-clip-text">
                <DynamicGreeting />
              </h1>
              <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
                {greetingSubtitle}
              </p>
            </div>
          )
        )}

        {visibleMessages.map((msg) => (
          <ChatMessageItem
            key={msg.id}
            msg={msg}
            chatMode={chatMode}
            localePrefix={localePrefix}
            editingId={editingId}
            editContent={editContent}
            onEditContentChange={onEditContentChange}
            editKeepAttachments={editKeepAttachments}
            setEditKeepAttachments={setEditKeepAttachments}
            editAttachments={editAttachments}
            setEditAttachments={setEditAttachments}
            editFileInputRef={editFileInputRef}
            onHandleFileSelect={onHandleFileSelect}
            isGenerating={isGenerating}
            onCancelEdit={onCancelEdit}
            onCommitEdit={onCommitEdit}
            onStartEdit={onStartEdit}
            onRegenerate={onRegenerate}
            onOpenAttachmentPreview={onOpenAttachmentPreview}
            getAgentPartsForMessage={getAgentPartsForMessage}
            onOpenSubAgent={onOpenSubAgent}
          />
        ))}

        {chatMode === "agent" && isGenerating && !agentUIMessages.some((msg) => msg.role === "assistant" && msg.isStreaming) && (
          <div className="flex w-full justify-start">
            <AgentProgressTicker />
          </div>
        )}

        {chatMode === "agent" && agentSessionId && permissions.length > 0 && (
          <div className="space-y-3">
            {permissions.map((perm) => (
              <AgentPermissionCard
                key={perm.id}
                perm={perm}
                sessionId={agentSessionId}
              />
            ))}
          </div>
        )}
        {chatMode === "agent" && agentSessionId && questions.length > 0 && (
          <div className="space-y-3">
            {questions.map((q) => (
              <AgentQuestionCard
                key={q.id}
                question={q}
                sessionId={agentSessionId}
              />
            ))}
          </div>
        )}

        {chatMode !== "agent" && <StatusBadge text={statusText} />}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {showScrollButton && (
        <div className="sticky bottom-4 flex justify-center w-full pointer-events-none z-20">
          <button
            onClick={onScrollToBottom}
            className="pointer-events-auto flex items-center justify-center h-8 w-8 rounded-full bg-background/80 backdrop-blur border border-border shadow-md text-muted-foreground hover:text-foreground hover:bg-background transition-all"
            aria-label="捲動到最底部"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
