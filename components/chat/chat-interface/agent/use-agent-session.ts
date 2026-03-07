"use client"

import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import { isSuppressedApiError } from "./agent-session-api"
import type { AgentRuntimeConfig } from "./agent-session-config"
import type {
  OptimisticUserMessage,
  PendingPrompt,
} from "./agent-session-internal-types"
import { initialState, agentSessionReducer } from "./agent-session-state"
import type { AgentState } from "./types"
import { useAgentSessionActions } from "./use-agent-session-actions"
import { useAgentSessionSync } from "./use-agent-session-sync"

export type { AgentRuntimeConfig, AgentRuntimeModel } from "./agent-session-config"

export function useAgentSession(defaultRuntimeConfig?: AgentRuntimeConfig) {
  const [state, dispatch] = useReducer(agentSessionReducer, initialState)
  const [isConnected, setIsConnected] = useState(false)
  const [pendingPrompts, setPendingPrompts] = useState<PendingPrompt[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const stateRef = useRef<AgentState>(initialState)
  const previousStatusRef = useRef<AgentState["status"]>(initialState.status)
  const pendingPartDeltasRef = useRef<Map<string, Record<string, string>>>(new Map())
  const knownPartIdsRef = useRef<Set<string>>(new Set())
  const messageSyncEpochRef = useRef(0)
  const optimisticUserMessagesRef = useRef<Map<string, OptimisticUserMessage>>(new Map())
  const queueDrainRef = useRef(false)
  const intentionalSwitchRef = useRef(false)
  const subscribedSessionIdRef = useRef<string | null>(null)
  const sessionListenerReadyRef = useRef<string | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const handleApiError = useCallback((err: unknown) => {
    if (isSuppressedApiError(err)) {
      dispatch({ type: "CLEAR_ERROR" })
      if (err.health && err.health.healthy === false) {
        setIsConnected(false)
      }
      return
    }

    const message = err instanceof Error ? err.message : "Unknown error"
    dispatch({ type: "SET_ERROR", error: message })
  }, [])

  const { syncSessionMessages, refreshSessionStatus } = useAgentSessionSync({
    state,
    dispatch,
    stateRef,
    previousStatusRef,
    pendingPartDeltasRef,
    knownPartIdsRef,
    messageSyncEpochRef,
    optimisticUserMessagesRef,
    intentionalSwitchRef,
    subscribedSessionIdRef,
    sessionListenerReadyRef,
    setIsConnected,
  })

  const actions = useAgentSessionActions({
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
  })

  const isBusy =
    state.status.type === "busy" ||
    state.status.type === "retry"

  return {
    state,
    ...actions,
    isConnected,
    isBusy,
    pendingPrompts,
  }
}
