"use client"

import { useEffect, useMemo } from "react"
import { ChevronDown, Loader2, X } from "lucide-react"
import { AgentMessage } from "./agent-message"
import { useAgentSession } from "./use-agent-session"
import { useAutoScroll } from "../hooks/use-auto-scroll"

export function SubAgentSidebar({
  sessionId,
  onClose,
}: {
  sessionId: string
  onClose: () => void
}) {
  const { state, isBusy, loadSession } = useAgentSession()
  const { messagesEndRef, scrollContainerRef, showScrollButton, scrollToBottom } =
    useAutoScroll(isBusy)

  useEffect(() => {
    loadSession(sessionId)
  }, [loadSession, sessionId])

  const lastAssistantId = useMemo(() => {
    for (let i = state.messageOrder.length - 1; i >= 0; i -= 1) {
      const id = state.messageOrder[i]
      if (state.messages[id]?.role === "assistant") return id
    }
    return null
  }, [state.messageOrder, state.messages])

  const loading =
    state.sessionId !== sessionId ||
    (state.messageOrder.length === 0 && state.status.type !== "idle" && !state.error)

  return (
    <div className="w-[40%] min-w-[320px] max-w-[560px] border-l border-border bg-card h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border/60 shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">Sub-agent</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {isBusy ? "RUNNING" : loading ? "LOADING" : "FINISHED"} · {sessionId.slice(0, 12)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3 [scrollbar-color:auto_transparent] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:bg-transparent"
      >
        {loading && state.messageOrder.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : state.messageOrder.length === 0 ? (
          <p className="text-xs text-muted-foreground">尚未收到 subagent 訊息。</p>
        ) : (
          state.messageOrder.map((id) => {
            const msg = state.messages[id]
            if (!msg) return null
            return (
              <AgentMessage
                key={id}
                message={msg}
                parts={state.parts[id] || []}
                isBusy={isBusy && id === lastAssistantId}
              />
            )
          })
        )}

        <div ref={messagesEndRef} className="h-2" />

        {showScrollButton && (
          <div className="sticky bottom-2 flex justify-center w-full pointer-events-none z-20">
            <button
              onClick={scrollToBottom}
              className="pointer-events-auto flex items-center justify-center h-8 w-8 rounded-full bg-background/80 backdrop-blur border border-border shadow-md text-muted-foreground hover:text-foreground hover:bg-background transition-all"
              aria-label="捲動到最底部"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
