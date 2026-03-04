"use client"

import { useReducer, useCallback, useMemo, useRef, useEffect } from "react"
import { binarySearch, sortedUpsert, sortedRemove } from "@/lib/agent/binary-search"
import type {
  AgentMessage,
  AgentPart,
  AgentSessionStatus,
  PermissionRequest,
  QuestionRequest,
  AgentSSEEvent,
} from "@/lib/agent/types"

// ─── State ───────────────────────────────────────────────────────────

export type AgentStoreState = {
  messages: Record<string, AgentMessage[]>        // sessionID → sorted messages
  parts: Record<string, AgentPart[]>              // messageID → sorted parts
  sessionStatus: Record<string, AgentSessionStatus>
  permissions: Record<string, PermissionRequest[]>
  questions: Record<string, QuestionRequest[]>
}

const INITIAL_STATE: AgentStoreState = {
  messages: {},
  parts: {},
  sessionStatus: {},
  permissions: {},
  questions: {},
}

// ─── Actions ─────────────────────────────────────────────────────────

export type AgentStoreAction =
  | { type: "SSE_BATCH"; events: AgentSSEEvent[] }
  | { type: "BULK_LOAD"; sessionID: string; messages: AgentMessage[]; parts: Record<string, AgentPart[]> }
  | { type: "SET_PENDING_REQUESTS"; sessionID: string; permissions: PermissionRequest[]; questions: QuestionRequest[] }
  | { type: "RESET" }

// ─── Helpers ─────────────────────────────────────────────────────────

const msgKey = (m: AgentMessage) => m.id
const partKey = (p: AgentPart) => p.id

function sortByKey<T>(arr: T[], keyFn: (item: T) => string): T[] {
  return [...arr].sort((a, b) => keyFn(a).localeCompare(keyFn(b)))
}

function appendDeltaByFieldPath(target: Record<string, any>, fieldPath: string, delta: string) {
  if (!fieldPath) return
  const segments = fieldPath.split(".").filter(Boolean)
  if (segments.length === 0) return

  let node: Record<string, any> = target
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]
    const current = node[segment]
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      node[segment] = {}
    }
    node = node[segment]
  }

  const leaf = segments[segments.length - 1]
  const existing = node[leaf]
  node[leaf] = (typeof existing === "string" ? existing : "") + delta
}

function applySSEEvent(state: AgentStoreState, event: AgentSSEEvent): AgentStoreState {
  switch (event.type) {
    case "message.updated": {
      const { sessionID, info } = event.properties
      const msg: AgentMessage = { ...info, sessionID }
      const prev = state.messages[sessionID] || []
      return {
        ...state,
        messages: { ...state.messages, [sessionID]: sortedUpsert(prev, msg, msgKey) },
      }
    }

    case "message.removed": {
      const { sessionID, messageID } = event.properties
      const prev = state.messages[sessionID] || []
      return {
        ...state,
        messages: { ...state.messages, [sessionID]: sortedRemove(prev, messageID, msgKey) },
      }
    }

    case "message.part.updated": {
      const { messageID, part } = event.properties
      const prev = state.parts[messageID] || []
      return {
        ...state,
        parts: { ...state.parts, [messageID]: sortedUpsert(prev, part, partKey) },
      }
    }

    case "message.part.removed": {
      const { messageID, partID } = event.properties
      const prev = state.parts[messageID] || []
      return {
        ...state,
        parts: { ...state.parts, [messageID]: sortedRemove(prev, partID, partKey) },
      }
    }

    case "message.part.delta": {
      const { messageID, partID, field, delta } = event.properties
      const prev = state.parts[messageID] || []
      const { found, index } = binarySearch(prev, partID, partKey)
      if (!found) return state
      const part = { ...prev[index] } as any
      appendDeltaByFieldPath(part, field, delta)
      const next = [...prev]
      next[index] = part
      return {
        ...state,
        parts: { ...state.parts, [messageID]: next },
      }
    }

    case "session.status": {
      const status = event.properties
      return {
        ...state,
        sessionStatus: { ...state.sessionStatus, [status.sessionID]: status },
      }
    }

    case "permission.asked": {
      const perm = event.properties
      const prev = state.permissions[perm.sessionID] || []
      const exists = prev.some((p) => p.id === perm.id)
      if (exists) return state
      return {
        ...state,
        permissions: { ...state.permissions, [perm.sessionID]: [...prev, perm] },
      }
    }

    case "permission.replied": {
      const { id, sessionID } = event.properties
      const prev = state.permissions[sessionID] || []
      return {
        ...state,
        permissions: { ...state.permissions, [sessionID]: prev.filter((p) => p.id !== id) },
      }
    }

    case "question.asked": {
      const q = event.properties
      const prev = state.questions[q.sessionID] || []
      const exists = prev.some((p) => p.id === q.id)
      if (exists) return state
      return {
        ...state,
        questions: { ...state.questions, [q.sessionID]: [...prev, q] },
      }
    }

    case "question.replied":
    case "question.rejected": {
      const { requestID, sessionID } = event.properties
      const prev = state.questions[sessionID] || []
      return {
        ...state,
        questions: { ...state.questions, [sessionID]: prev.filter((q) => q.id !== requestID) },
      }
    }

    default:
      return state
  }
}

function reducer(state: AgentStoreState, action: AgentStoreAction): AgentStoreState {
  switch (action.type) {
    case "SSE_BATCH": {
      let s = state
      for (const event of action.events) {
        s = applySSEEvent(s, event)
      }
      return s
    }
    case "BULK_LOAD": {
      const { sessionID, messages, parts } = action
      const sortedMessages = sortByKey(messages, msgKey)
      const sortedParts: Record<string, AgentPart[]> = {}
      for (const [messageID, list] of Object.entries(parts)) {
        sortedParts[messageID] = sortByKey(list, partKey)
      }
      return {
        ...state,
        messages: { ...state.messages, [sessionID]: sortedMessages },
        parts: { ...state.parts, ...sortedParts },
      }
    }
    case "SET_PENDING_REQUESTS": {
      const { sessionID, permissions, questions } = action
      return {
        ...state,
        permissions: { ...state.permissions, [sessionID]: permissions },
        questions: { ...state.questions, [sessionID]: questions },
      }
    }
    case "RESET":
      return INITIAL_STATE
    default:
      return state
  }
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useAgentStore(sessionId: string | undefined) {
  const [state, rawDispatch] = useReducer(reducer, INITIAL_STATE)

  // Event batching: queue SSE events, flush via rAF
  const queueRef = useRef<AgentSSEEvent[]>([])
  const rafRef = useRef<number | null>(null)

  const flushQueue = useCallback(() => {
    rafRef.current = null
    if (queueRef.current.length === 0) return
    const batch = queueRef.current
    queueRef.current = []
    rawDispatch({ type: "SSE_BATCH", events: batch })
  }, [])

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const dispatch = useCallback((action: AgentStoreAction) => {
    if (action.type === "SSE_BATCH") {
      // Queue individual events
      queueRef.current.push(...action.events)
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushQueue)
      }
    } else {
      // BULK_LOAD and RESET dispatch immediately
      rawDispatch(action)
    }
  }, [flushQueue])

  /** Enqueue a single SSE event */
  const enqueueEvent = useCallback((event: AgentSSEEvent) => {
    // Session filter: skip events not for our session (unless global)
    if (sessionId) {
      const props = event.properties as any
      const eventSessionID = props?.sessionID ?? props?.info?.sessionID ?? props?.part?.sessionID
      if (eventSessionID && eventSessionID !== sessionId) return
    }
    queueRef.current.push(event)
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushQueue)
    }
  }, [sessionId, flushQueue])

  const messages = useMemo(
    () => (sessionId ? state.messages[sessionId] || [] : []),
    [state.messages, sessionId]
  )

  const partsFor = useCallback(
    (msgId: string): AgentPart[] => state.parts[msgId] || [],
    [state.parts]
  )

  const sessionStatus = useMemo(
    () => (sessionId ? state.sessionStatus[sessionId] : undefined),
    [state.sessionStatus, sessionId]
  )

  const isBusy = useMemo(
    () => {
      const status = String(sessionStatus?.status || "").toLowerCase()
      return (
        status === "busy" ||
        status === "retry" ||
        status === "running" ||
        status === "in_progress" ||
        status === "in-progress" ||
        status === "processing"
      )
    },
    [sessionStatus]
  )

  const permissions = useMemo(
    () => (sessionId ? state.permissions[sessionId] || [] : []),
    [state.permissions, sessionId]
  )

  const questions = useMemo(
    () => (sessionId ? state.questions[sessionId] || [] : []),
    [state.questions, sessionId]
  )

  return {
    state,
    dispatch,
    enqueueEvent,
    messages,
    partsFor,
    sessionStatus,
    isBusy,
    permissions,
    questions,
  }
}
