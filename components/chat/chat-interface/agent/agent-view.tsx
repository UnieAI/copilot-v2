"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Loader2, RefreshCw, ServerCrash } from "lucide-react"
import { useAgentSession } from "./use-agent-session"
import { AgentMessage } from "./agent-message"
import { AgentParts } from "./agent-parts"
import { PermissionBanner } from "./permission-banner"
import { QuestionBanner } from "./question-banner"
import { TodoPanel } from "./todo-panel"
import { TextShimmer } from "./text-shimmer"
import { SubAgentSidebar } from "./subagent-sidebar"
import { useAutoScroll } from "../hooks/use-auto-scroll"
import type { Message, Part } from "./types"
import type { AgentRuntimeConfig } from "./use-agent-session"

// Max startup timeout = pollHealth maxAttempts(20) * intervalMs(1500) = 30s
const STARTUP_TIMEOUT_SEC = 30

function StartupCountdown({
  agentStatus,
  agentStartedAt,
}: {
  agentStatus: "idle" | "starting" | "connected" | "error"
  agentStartedAt: number | null
}) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (agentStatus !== "starting" || !agentStartedAt) {
      setElapsed(0)
      return
    }

    setElapsed(Math.floor((Date.now() - agentStartedAt) / 1000))

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - agentStartedAt) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [agentStatus, agentStartedAt])

  if (agentStatus === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[30vh] text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-4 bg-red-500/10 rounded-full mb-4">
          <ServerCrash className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight mb-2 text-foreground/80">
          Sandbox 啟動失敗
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          請確認 Docker 正在運行，然後切換回 Normal 再重新切換到 Agent 模式重試。
        </p>
      </div>
    )
  }

  if (agentStatus !== "starting") return null

  const remaining = Math.max(0, STARTUP_TIMEOUT_SEC - elapsed)
  const progress = Math.min(100, (elapsed / STARTUP_TIMEOUT_SEC) * 100)

  return (
    <div className="flex flex-col items-center justify-center min-h-[30vh] text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* <div className="relative mb-6">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40" cy="40" r="34"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-muted/30"
          />
          <circle
            cx="40" cy="40" r="34"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 34}`}
            strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
            strokeLinecap="round"
            className="text-blue-500 transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold tabular-nums text-blue-600 dark:text-blue-400">
            {remaining}s
          </span>
        </div>
      </div> */}
      <h2 className="text-xl font-semibold tracking-tight mb-2 text-foreground/80">
        啟動 Agent Sandbox
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mb-3">
        {elapsed < 5
          ? "正在啟動 Docker 容器..."
          : elapsed < 15
            ? "正在等待服務就緒..."
            : "即將完成，請稍候..."}
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>已等待 {elapsed} 秒</span>
      </div>
    </div>
  )
}

export function AgentView({
  agentRef,
  initialSessionId,
  onSessionChange,
  agentStatus,
  agentStartedAt,
  onBusyChange,
  runtimeConfig,
}: {
  agentRef: React.MutableRefObject<ReturnType<typeof useAgentSession> | null>
  initialSessionId?: string
  onSessionChange?: (sessionId: string) => void
  agentStatus: "idle" | "starting" | "connected" | "error"
  agentStartedAt: number | null
  onBusyChange?: (busy: boolean) => void
  runtimeConfig?: AgentRuntimeConfig
}) {
  const agent = useAgentSession(runtimeConfig)
  const { messagesEndRef, scrollContainerRef, showScrollButton, scrollToBottom } = useAutoScroll(agent.isBusy)
  const bootstrapAttemptedRef = useRef(false)
  const [subAgentSessionId, setSubAgentSessionId] = useState<string | null>(null)

  useEffect(() => {
    setSubAgentSessionId(null)
  }, [agent.state.sessionId])

  // Expose agent to parent
  useEffect(() => {
    agentRef.current = agent
  }, [agent, agentRef])

  const onBusyChangeRef = useRef(onBusyChange)
  onBusyChangeRef.current = onBusyChange
  useEffect(() => {
    onBusyChangeRef.current?.(agent.isBusy)
  }, [agent.isBusy])

  // Load the target session when sandbox becomes connected (only if initialSessionId is provided).
  // If no initialSessionId, stay on the homepage — session is created lazily on first sendMessage.
  useEffect(() => {
    if (agentStatus !== "connected" || agent.state.sessionId || bootstrapAttemptedRef.current) return
    if (!initialSessionId) return

    bootstrapAttemptedRef.current = true
    agent.loadSession(initialSessionId)
  }, [agent.loadSession, agent.state.sessionId, agentStatus, initialSessionId])

  useEffect(() => {
    if (agentStatus !== "connected") {
      bootstrapAttemptedRef.current = false
    }
  }, [agentStatus])

  // Notify parent when session ID changes to a real value (not null).
  // When session resets to null (new conversation), don't update the URL —
  // it would change the component key and cause a full remount.
  const onSessionChangeRef = useRef(onSessionChange)
  onSessionChangeRef.current = onSessionChange
  useEffect(() => {
    if (!agent.state.sessionId) return
    onSessionChangeRef.current?.(agent.state.sessionId)
  }, [agent.state.sessionId])

  // If URL id changes (sidebar navigation), switch session without requiring remount.
  useEffect(() => {
    if (agentStatus !== "connected" || !initialSessionId || !agent.state.sessionId) return
    if (initialSessionId === agent.state.sessionId) return
    agent.loadSession(initialSessionId)
  }, [agent.loadSession, agent.state.sessionId, agentStatus, initialSessionId])

  const handleRegenerate = useCallback((messageId: string) => {
    agent.regenerate(messageId)
  }, [agent])

  const { messages, parts } = agent.state
  const orderedMessages = useMemo(
    () => Object.values(messages).sort((a, b) => a.id.localeCompare(b.id)),
    [messages],
  )

  const pendingAssistant = useMemo(
    () =>
      [...orderedMessages]
        .reverse()
        .find(
          (message): message is Extract<Message, { role: "assistant" }> =>
            message.role === "assistant" &&
            typeof message.time?.completed !== "number",
        ),
    [orderedMessages],
  )

  const turns = useMemo(() => {
    const result: Array<{
      userId: string
      userMessage: Extract<Message, { role: "user" }>
      userParts: Part[]
      assistantIds: string[]
      assistantParts: Part[]
      lastAssistantId?: string
      active: boolean
      queued: boolean
    }> = []
    const pendingUserId = pendingAssistant?.parentID

    orderedMessages.forEach((message, index) => {
      if (message.role !== "user") return

      const assistantMessages: Array<Extract<Message, { role: "assistant" }>> = []
      for (let cursor = index + 1; cursor < orderedMessages.length; cursor++) {
        const next = orderedMessages[cursor]
        if (!next) continue
        if (next.role === "user") break
        if (next.parentID === message.id) {
          assistantMessages.push(next)
        }
      }

      result.push({
        userId: message.id,
        userMessage: message,
        userParts: parts[message.id] || [],
        assistantIds: assistantMessages.map((item) => item.id),
        assistantParts: assistantMessages.flatMap((item) => parts[item.id] || []),
        lastAssistantId: assistantMessages.at(-1)?.id,
        active: pendingUserId === message.id,
        queued: Boolean(pendingAssistant && message.id > pendingAssistant.id),
      })
    })

    return result
  }, [orderedMessages, parts, pendingAssistant])

  const activeTurn = turns.find((turn) => turn.active)
  const lastAssistantId = [...turns]
    .reverse()
    .map((turn) => turn.lastAssistantId)
    .find(Boolean)

  // Show startup/error screen when not connected
  if (agentStatus !== "connected") {
    return (
      <div className="flex-1 overflow-y-auto w-full flex items-center justify-center">
        <StartupCountdown
          agentStatus={agentStatus}
          agentStartedAt={agentStartedAt}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex flex-col flex-1 min-w-0 h-full min-h-0">
        {/* Messages */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto min-h-0 w-full [scrollbar-color:auto_transparent] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:bg-transparent"
        >
          <div className="mx-auto w-full max-w-3xl space-y-4 py-8 px-4">
            {orderedMessages.length === 0 && !agent.isBusy && (
              <div className="flex flex-col items-center justify-center min-h-[30vh] text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <h2 className="mt-32 text-2xl font-semibold tracking-tight mb-2 text-foreground/80">
                  Agent Mode
                </h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  輸入訊息來開始使用 coding agent。
                </p>
              </div>
            )}

            {turns.map((turn) => (
              <div key={turn.userId} className="space-y-1">
                <AgentMessage
                  message={turn.userMessage}
                  parts={turn.userParts}
                />

                {turn.assistantIds.length > 0 ? (
                  <div className="py-1">
                    <AgentParts
                      parts={turn.assistantParts}
                      isBusy={agent.isBusy && turn.active}
                      onOpenSubAgent={setSubAgentSessionId}
                    />
                    {!agent.isBusy && turn.lastAssistantId && turn.lastAssistantId === lastAssistantId && (
                      <div className="mt-1 flex justify-start">
                        <button
                          onClick={() => handleRegenerate(turn.lastAssistantId!)}
                          className="flex items-center gap-1.5 rounded-full px-1.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60"
                          title="重新生成"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : turn.queued ? (
                  <div className="ml-auto flex max-w-[85%] items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Queued</span>
                  </div>
                ) : null}
              </div>
            ))}

            {/* Busy indicator */}
            {agent.isBusy &&
              turns.length > 0 &&
              (() => {
                const showIndicator = !activeTurn || activeTurn.assistantParts.length === 0
                return showIndicator ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <TextShimmer text="Thinking..." />
                  </div>
                ) : null
              })()}

            {/* Status: retry */}
            {agent.state.status.type === "retry" && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>
                  Retrying (attempt {agent.state.status.attempt})...{" "}
                  {agent.state.status.message}
                </span>
              </div>
            )}

            {/* Error */}
            {agent.state.error && (
              <div className="px-3 py-2 text-xs text-red-500 bg-red-500/5 rounded-lg">
                {agent.state.error}
              </div>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>

          {showScrollButton && (
            <div className="sticky bottom-4 flex justify-center w-full pointer-events-none z-20">
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

        {/* Permission banner */}
        {agent.state.permission && (
          <PermissionBanner
            request={agent.state.permission}
            onReply={agent.replyPermission}
          />
        )}

        {/* Question banner */}
        {agent.state.question && (
          <QuestionBanner
            request={agent.state.question}
            onReply={agent.replyQuestion}
            onReject={agent.rejectQuestion}
          />
        )}

        {/* Todo panel */}
        {agent.state.todos.length > 0 && (
          <div className="shrink-0 px-4 pt-1 pb-0 -mb-1 z-10">
            <div className="mx-auto w-full max-w-3xl">
              <TodoPanel todos={agent.state.todos} />
            </div>
          </div>
        )}
      </div>

      {subAgentSessionId && (
        <SubAgentSidebar
          sessionId={subAgentSessionId}
          onClose={() => setSubAgentSessionId(null)}
        />
      )}
    </div>
  )
}
