"use client"

import { useCallback, useEffect } from "react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { api, normalizeSessionList, pickSessionId } from "./agent-session-api"
import type { AgentRuntimeConfig } from "./agent-session-config"
import type {
  OptimisticUserMessage,
  PendingPrompt,
} from "./agent-session-internal-types"
import { createLocalAscendingId } from "./agent-session-helpers"
import { initialState } from "./agent-session-state"
import type { AgentSessionAction } from "./agent-session-state"
import type {
  AgentState,
  Message,
  QuestionAnswer,
  Session,
} from "./types"

type SetPendingPrompts = Dispatch<SetStateAction<PendingPrompt[]>>

function traceAgentSessionEvent(
  type: string,
  detail: Record<string, unknown>,
) {
  console.info("[agent-session-trace]", type, detail)
}

export function useAgentSessionActions({
  state,
  dispatch,
  stateRef,
  abortRef,
  queueDrainRef,
  pendingPrompts,
  setPendingPrompts,
  pendingPartDeltasRef,
  knownPartIdsRef,
  messageSyncEpochRef,
  optimisticUserMessagesRef,
  intentionalSwitchRef,
  subscribedSessionIdRef,
  sessionListenerReadyRef,
  defaultRuntimeConfig,
  handleApiError,
  syncSessionMessages,
  refreshSessionStatus,
}: {
  state: AgentState
  dispatch: Dispatch<AgentSessionAction>
  stateRef: MutableRefObject<AgentState>
  abortRef: MutableRefObject<AbortController | null>
  queueDrainRef: MutableRefObject<boolean>
  pendingPrompts: PendingPrompt[]
  setPendingPrompts: SetPendingPrompts
  pendingPartDeltasRef: MutableRefObject<Map<string, Record<string, string>>>
  knownPartIdsRef: MutableRefObject<Set<string>>
  messageSyncEpochRef: MutableRefObject<number>
  optimisticUserMessagesRef: MutableRefObject<Map<string, OptimisticUserMessage>>
  intentionalSwitchRef: MutableRefObject<boolean>
  subscribedSessionIdRef: MutableRefObject<string | null>
  sessionListenerReadyRef: MutableRefObject<string | null>
  defaultRuntimeConfig?: AgentRuntimeConfig
  handleApiError: (err: unknown) => void
  syncSessionMessages: (targetSessionId: string) => Promise<void>
  refreshSessionStatus: (targetSessionId: string, options?: { force?: boolean }) => Promise<void>
}) {
  const resetTransientState = useCallback((sessionId: string | null) => {
    messageSyncEpochRef.current += 1
    pendingPartDeltasRef.current.clear()
    knownPartIdsRef.current.clear()
    optimisticUserMessagesRef.current.clear()
    setPendingPrompts([])
    stateRef.current = sessionId
      ? {
          ...initialState,
          sessionId,
        }
      : initialState
  }, [
    knownPartIdsRef,
    messageSyncEpochRef,
    optimisticUserMessagesRef,
    pendingPartDeltasRef,
    setPendingPrompts,
    stateRef,
  ])

  const createOptimisticUserMessage = useCallback((
    sessionId: string,
    text: string,
    runtimeConfig?: AgentRuntimeConfig,
  ) => {
    const createdAt = Date.now()
    const messageId = createLocalAscendingId("msg")
    const partId = createLocalAscendingId("prt")
    const model = runtimeConfig?.model ?? {
      providerID: "unknown",
      modelID: "unknown",
    }
    const optimisticMessage: Message = {
      id: messageId,
      sessionID: sessionId,
      role: "user",
      time: { created: createdAt },
      agent: runtimeConfig?.agent || "build",
      model,
      variant: runtimeConfig?.variant,
    }

    optimisticUserMessagesRef.current.set(messageId, {
      sessionId,
      text,
      createdAt,
    })

    dispatch({
      type: "SSE_EVENT",
      event: {
        type: "message.updated",
        properties: { info: optimisticMessage },
      },
    })
    dispatch({
      type: "SSE_EVENT",
      event: {
        type: "message.part.updated",
        properties: {
          part: {
            id: partId,
            sessionID: sessionId,
            messageID: messageId,
            type: "text",
            text,
          },
        },
      },
    })

    return {
      createdAt,
      messageId,
    }
  }, [dispatch, optimisticUserMessagesRef])

  const scheduleSessionResync = useCallback((sessionId: string) => {
    const delays = [1200, 3500]
    for (const delay of delays) {
      window.setTimeout(() => {
        void refreshSessionStatus(sessionId, { force: true })
      }, delay)
    }
  }, [refreshSessionStatus])

  const bootstrapAssistantStream = useCallback((sessionId: string) => {
    const delays = [120, 280]
    for (const delay of delays) {
      window.setTimeout(() => {
        const current = stateRef.current
        if (current.sessionId !== sessionId) return
        const busy =
          current.status.type === "busy" ||
          current.status.type === "retry"
        if (!busy) return

        const hasAssistant = current.messageOrder.some((messageId) => {
          const message = current.messages[messageId]
          return message?.sessionID === sessionId && message.role === "assistant"
        })
        if (hasAssistant) return

        void syncSessionMessages(sessionId)
      }, delay)
    }
  }, [stateRef, syncSessionMessages])

  const submitPrompt = useCallback(async (
    sessionId: string,
    text: string,
    options?: {
      existingMessageId?: string
      runtimeConfig?: AgentRuntimeConfig
    },
  ) => {
    const trimmed = text.trim()
    if (!trimmed) return false

    const runtimeConfig = options?.runtimeConfig ?? defaultRuntimeConfig
    const optimistic =
      options?.existingMessageId
        ? { messageId: options.existingMessageId }
        : createOptimisticUserMessage(sessionId, trimmed, runtimeConfig)

    messageSyncEpochRef.current += 1
    abortRef.current = new AbortController()
    if (stateRef.current.sessionId === sessionId) {
      stateRef.current = {
        ...stateRef.current,
        status: { type: "busy" },
      }
    }

    dispatch({
      type: "SSE_EVENT",
      event: {
        type: "session.status",
        properties: {
          sessionID: sessionId,
          status: { type: "busy" },
        },
      },
    })

    try {
      traceAgentSessionEvent("prompt-async-start", {
        sessionId,
        optimisticMessageId: optimistic.messageId,
      })
      await api(`/session/${sessionId}/prompt_async`, {
        method: "POST",
        body: JSON.stringify({
          ...(runtimeConfig?.agent ? { agent: runtimeConfig.agent } : {}),
          ...(runtimeConfig?.model ? { model: runtimeConfig.model } : {}),
          ...(runtimeConfig?.variant ? { variant: runtimeConfig.variant } : {}),
          messageID: optimistic.messageId,
          parts: [{ type: "text", text: trimmed }],
        }),
        signal: abortRef.current.signal,
      })
      traceAgentSessionEvent("prompt-async-accepted", {
        sessionId,
        optimisticMessageId: optimistic.messageId,
      })
      bootstrapAssistantStream(sessionId)
      scheduleSessionResync(sessionId)
      void refreshSessionStatus(sessionId, { force: true })
      return true
    } catch (err) {
      traceAgentSessionEvent("prompt-async-failed", {
        sessionId,
        optimisticMessageId: optimistic.messageId,
        errorName: err instanceof Error ? err.name : "unknown",
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      optimisticUserMessagesRef.current.delete(optimistic.messageId)
      dispatch({
        type: "SSE_EVENT",
        event: {
          type: "message.removed",
          properties: {
            sessionID: sessionId,
            messageID: optimistic.messageId,
          },
        },
      })
      dispatch({
        type: "SSE_EVENT",
        event: {
          type: "session.idle",
          properties: { sessionID: sessionId },
        },
      })
      if (stateRef.current.sessionId === sessionId) {
        stateRef.current = {
          ...stateRef.current,
          status: { type: "idle" },
        }
      }
      if ((err as { name?: string } | undefined)?.name !== "AbortError") {
        handleApiError(err)
      }
      return false
    }
  }, [
    abortRef,
    bootstrapAssistantStream,
    createOptimisticUserMessage,
    defaultRuntimeConfig,
    dispatch,
    handleApiError,
    messageSyncEpochRef,
    optimisticUserMessagesRef,
    refreshSessionStatus,
    scheduleSessionResync,
    stateRef,
  ])

  const createNewSession = useCallback(async () => {
    try {
      const payload = await api<any>("/session", {
        method: "POST",
        body: JSON.stringify({}),
      })
      const sessionId = pickSessionId(payload)
      if (!sessionId) {
        throw new Error("Session created but no session ID was returned")
      }
      resetTransientState(sessionId)
      dispatch({ type: "SET_SESSION", sessionId })
    } catch (err) {
      handleApiError(err)
    }
  }, [dispatch, handleApiError, resetTransientState])

  const resetSession = useCallback(() => {
    intentionalSwitchRef.current = true
    resetTransientState(null)
    dispatch({ type: "RESET" })
  }, [dispatch, intentionalSwitchRef, resetTransientState])

  const loadSession = useCallback(async (sessionId: string) => {
    traceAgentSessionEvent("load-session", {
      fromSessionId: stateRef.current.sessionId,
      toSessionId: sessionId,
      currentStatus: stateRef.current.status.type,
    })
    intentionalSwitchRef.current = true
    resetTransientState(sessionId)
    dispatch({ type: "SET_SESSION", sessionId })
  }, [dispatch, intentionalSwitchRef, resetTransientState])

  const waitForSessionSubscription = useCallback(async (sessionId: string) => {
    const deadline = Date.now() + 1500
    while (
      (subscribedSessionIdRef.current !== sessionId ||
        sessionListenerReadyRef.current !== sessionId) &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => window.setTimeout(resolve, 16))
    }
  }, [sessionListenerReadyRef, subscribedSessionIdRef])

  const sendMessage = useCallback(
    async (text: string, runtimeConfig?: AgentRuntimeConfig) => {
      let sessionId = stateRef.current.sessionId
      let createdSession = false
      const trimmed = text.trim()
      if (!trimmed) return

      if (!sessionId) {
        try {
          const payload = await api<any>("/session", {
            method: "POST",
            body: JSON.stringify({}),
          })
          sessionId = pickSessionId(payload)
          if (!sessionId) {
            throw new Error("Session created but no session ID was returned")
          }
          resetTransientState(sessionId)
          dispatch({ type: "SET_SESSION", sessionId })
          createdSession = true
        } catch (err) {
          handleApiError(err)
          return
        }
      }

      if (createdSession || subscribedSessionIdRef.current !== sessionId) {
        await waitForSessionSubscription(sessionId)
      }

      const current = stateRef.current
      const currentlyBusy =
        current.sessionId === sessionId &&
        (
          current.status.type === "busy" ||
          current.status.type === "retry"
        )

      if (currentlyBusy) {
        traceAgentSessionEvent("send-skipped-busy", {
          sessionId,
          status: current.status.type,
        })
        setPendingPrompts([])
        dispatch({ type: "CLEAR_ERROR" })
        return
      }

      traceAgentSessionEvent("send-message", {
        sessionId,
        createdSession,
        runtimeAgent: runtimeConfig?.agent ?? defaultRuntimeConfig?.agent ?? null,
      })
      await submitPrompt(sessionId, trimmed, { runtimeConfig })
    },
    [
      createOptimisticUserMessage,
      defaultRuntimeConfig,
      dispatch,
      handleApiError,
      resetTransientState,
      setPendingPrompts,
      stateRef,
      submitPrompt,
      subscribedSessionIdRef,
      waitForSessionSubscription,
    ],
  )

  const abort = useCallback(async () => {
    traceAgentSessionEvent("manual-abort", {
      sessionId: state.sessionId,
      status: state.status.type,
    })
    abortRef.current?.abort()
    if (!state.sessionId) return
    try {
      await api(`/session/${state.sessionId}/abort`, { method: "POST" })
    } catch {
      // ignore
    }
  }, [abortRef, state.sessionId, state.status.type])

  const replyPermission = useCallback(
    async (reply: "once" | "always" | "reject") => {
      if (!state.sessionId || !state.permission) return
      try {
        await api(
          `/permission/${state.permission.id}/reply`,
          {
            method: "POST",
            body: JSON.stringify({ reply }),
          },
        )
      } catch (err) {
        handleApiError(err)
      }
    },
    [handleApiError, state.permission, state.sessionId],
  )

  const replyQuestion = useCallback(
    async (answers: QuestionAnswer[]) => {
      if (!state.sessionId || !state.question) return
      try {
        await api(
          `/question/${state.question.id}/reply`,
          {
            method: "POST",
            body: JSON.stringify({ answers }),
          },
        )
      } catch (err) {
        handleApiError(err)
      }
    },
    [handleApiError, state.question, state.sessionId],
  )

  const rejectQuestion = useCallback(async () => {
    if (!state.sessionId || !state.question) return
    try {
      await api(
        `/question/${state.question.id}/reject`,
        { method: "POST" },
      )
    } catch (err) {
      handleApiError(err)
    }
  }, [handleApiError, state.question, state.sessionId])

  const listSessions = useCallback(async (): Promise<Session[]> => {
    try {
      const payload = await api<any>("/session?roots=true")
      return normalizeSessionList(payload)
        .sort(
          (a, b) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0),
        )
    } catch {
      return []
    }
  }, [])

  const regenerate = useCallback(async (targetMessageId?: string) => {
    if (!state.sessionId) return

    const { messageOrder, messages } = state

    let targetIdx = -1
    if (targetMessageId) {
      targetIdx = messageOrder.indexOf(targetMessageId)
    } else {
      for (let i = messageOrder.length - 1; i >= 0; i -= 1) {
        const msg = messages[messageOrder[i]]
        if (msg?.role === "assistant") {
          targetIdx = i
          break
        }
      }
    }
    if (targetIdx < 0) return

    const targetMsg = messages[messageOrder[targetIdx]]
    if (!targetMsg || targetMsg.role !== "assistant") return

    let userText: string | null = null
    let userMsgIdx = -1
    let userRuntimeConfig: AgentRuntimeConfig | undefined
    for (let i = targetIdx - 1; i >= 0; i -= 1) {
      const msg = messages[messageOrder[i]]
      if (msg?.role === "user") {
        const userParts = state.parts[messageOrder[i]] || []
        const textPart = userParts.find((part) => part.type === "text")
        userText = textPart?.type === "text" ? textPart.text : null
        userMsgIdx = i
        userRuntimeConfig = {
          agent: msg.agent,
          model: msg.model,
          variant: msg.variant,
        }
        break
      }
    }
    if (!userText || userMsgIdx < 0) return

    const toDelete = messageOrder.slice(userMsgIdx)

    try {
      for (let i = toDelete.length - 1; i >= 0; i -= 1) {
        const msgId = toDelete[i]
        await api(`/session/${state.sessionId}/message/${msgId}`, {
          method: "DELETE",
        })
        dispatch({
          type: "SSE_EVENT",
          event: {
            type: "message.removed",
            properties: { sessionID: state.sessionId, messageID: msgId },
          },
        })
      }
    } catch (err) {
      handleApiError(err)
      return
    }

    dispatch({
      type: "SSE_EVENT",
      event: {
        type: "session.status",
        properties: {
          sessionID: state.sessionId,
          status: { type: "busy" },
        },
      },
    })
    try {
      const regenerateRuntimeConfig: AgentRuntimeConfig | undefined =
        defaultRuntimeConfig || userRuntimeConfig
          ? {
              agent: defaultRuntimeConfig?.agent ?? userRuntimeConfig?.agent,
              model: defaultRuntimeConfig?.model ?? userRuntimeConfig?.model,
              variant: defaultRuntimeConfig?.variant ?? userRuntimeConfig?.variant,
            }
          : undefined

      await submitPrompt(state.sessionId, userText, {
        runtimeConfig: regenerateRuntimeConfig,
      })
    } catch (err) {
      if ((err as { name?: string } | undefined)?.name !== "AbortError") {
        const now = Date.now()
        const localId = `local-err-${now}`
        dispatch({
          type: "SSE_EVENT",
          event: {
            type: "message.updated",
            properties: {
              info: {
                id: localId,
                sessionID: state.sessionId,
                role: "user",
                time: { created: now },
                agent: "user",
                model: { providerID: "unknown", modelID: "unknown" },
              },
            },
          },
        })
        dispatch({
          type: "SSE_EVENT",
          event: {
            type: "message.part.updated",
            properties: {
              part: {
                id: `part-${now}`,
                sessionID: state.sessionId,
                messageID: localId,
                type: "text",
                text: `${userText}\n\n[系統提示：網路錯誤導致重新生成失敗，請複製以上文字並手動重試]`,
              },
            },
          },
        })
        handleApiError(err)
      }
    }
  }, [
    defaultRuntimeConfig,
    dispatch,
    handleApiError,
    state,
    submitPrompt,
  ])

  useEffect(() => {
    if (pendingPrompts.length === 0) return
    setPendingPrompts([])
    queueDrainRef.current = false
  }, [pendingPrompts.length, queueDrainRef, setPendingPrompts])

  return {
    sendMessage,
    abort,
    replyPermission,
    replyQuestion,
    rejectQuestion,
    createNewSession,
    resetSession,
    loadSession,
    listSessions,
    regenerate,
  }
}
