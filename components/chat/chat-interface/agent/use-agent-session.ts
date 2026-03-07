"use client"

import { useReducer, useCallback, useRef, useEffect, useState } from "react"
import type {
  AgentState,
  Message,
  Part,
  SSEEvent,
  QuestionAnswer,
  Session,
} from "./types"
import {
  getOpencodeEventSnapshot,
  refreshOpencodeStatusSnapshot,
  subscribeOpencodeEvents,
  subscribeOpencodeSnapshot,
} from "./opencode-events"

const API_BASE = "/api/agent/opencode"
let localIdTimestamp = 0
let localIdCounter = 0

const initialState: AgentState = {
  sessionId: null,
  messages: {},
  messageOrder: [],
  parts: {},
  status: { type: "idle" },
  permission: null,
  question: null,
  todos: [],
  error: null,
}

type Action =
  | { type: "SET_SESSION"; sessionId: string }
  | { type: "RESET" }
  | { type: "SET_ERROR"; error: string }
  | { type: "CLEAR_ERROR" }
  | { type: "SSE_EVENT"; event: SSEEvent }

type AgentHealthPayload = {
  healthy?: boolean
  status?: string
}

type AgentApiError = Error & {
  status?: number
  suppressUserError?: boolean
  health?: AgentHealthPayload | null
}

type OptimisticUserMessage = {
  sessionId: string
  text: string
  createdAt: number
}

export type AgentRuntimeModel = {
  providerID: string
  modelID: string
}

export type AgentRuntimeConfig = {
  agent?: string
  model?: AgentRuntimeModel
  variant?: string
}

type PendingPrompt = {
  id: string
  sessionId: string
  text: string
  createdAt: number
  runtimeConfig?: AgentRuntimeConfig
}

function upsertMessageOrder(order: string[], id: string): string[] {
  if (order.includes(id)) return order
  return [...order, id]
}

function createLocalAscendingId(prefix: "msg" | "prt"): string {
  const now = Date.now()
  if (now !== localIdTimestamp) {
    localIdTimestamp = now
    localIdCounter = 0
  }
  localIdCounter += 1

  const monotonic = (BigInt(now) * 0x1000n + BigInt(localIdCounter))
    .toString(16)
    .padStart(12, "0")
    .slice(-12)
  const random = Math.random().toString(36).slice(2, 16).padEnd(14, "0").slice(0, 14)
  return `${prefix}_${monotonic}${random}`
}

function upsertPart(parts: Part[], part: Part): Part[] {
  const idx = parts.findIndex((p) => p.id === part.id)
  if (idx >= 0) {
    const next = [...parts]
    next[idx] = part
    return next
  }
  return [...parts, part]
}

function removePart(parts: Part[], partId: string): Part[] {
  return parts.filter((p) => p.id !== partId)
}

function applyDelta(
  parts: Part[],
  partId: string,
  field: string,
  delta: string,
): Part[] {
  const idx = parts.findIndex((p) => p.id === partId)
  if (idx < 0) return parts
  const next = [...parts]
  const part = { ...next[idx] } as any
  part[field] = (part[field] ?? "") + delta
  next[idx] = part
  return next
}

function normalizeSessionStatusValue(input: unknown): AgentState["status"] | null {
  if (!input) return null

  if (typeof input === "object" && input !== null) {
    const record = input as Record<string, unknown>
    if (record.status && typeof record.status === "object") {
      return normalizeSessionStatusValue(record.status)
    }
    if (record.state && typeof record.state === "object") {
      return normalizeSessionStatusValue(record.state)
    }
  }

  const obj =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : null
  const raw =
    (typeof input === "string" && input) ||
    (typeof obj?.type === "string" && obj.type) ||
    (typeof obj?.status === "string" && obj.status) ||
    ""
  const value = raw.trim().toLowerCase()

  if (value === "retry" || value === "retrying") {
    return {
      type: "retry",
      attempt: Number(obj?.attempt || 0),
      message: String(obj?.message || ""),
      next: Number(obj?.next || 0),
    }
  }

  if (
    value === "busy" ||
    value === "running" ||
    value === "processing" ||
    value === "in_progress" ||
    value === "in-progress" ||
    value === "pending" ||
    value === "queued" ||
    value === "waiting"
  ) {
    return { type: "busy" }
  }

  if (
    value === "idle" ||
    value === "done" ||
    value === "completed" ||
    value === "complete" ||
    value === "finished" ||
    value === "stopped"
  ) {
    return { type: "idle" }
  }

  if (obj && typeof obj.attempt !== "undefined" && typeof obj.next !== "undefined") {
    return {
      type: "retry",
      attempt: Number(obj.attempt || 0),
      message: String(obj.message || ""),
      next: Number(obj.next || 0),
    }
  }

  return null
}

function pickVisibleUserText(parts: Part[]): string {
  const textPart = parts.find(
    (part): part is Extract<Part, { type: "text" }> =>
      part.type === "text" &&
      typeof part.text === "string" &&
      part.synthetic !== true,
  )
  return (textPart?.text || "").trim()
}

function isTerminalAssistantMessage(message: Message): boolean {
  if (message.role !== "assistant") return false
  if (message.error) return true

  const finish = typeof message.finish === "string" ? message.finish : ""
  const isTerminalFinish = Boolean(finish) && !["tool-calls", "unknown"].includes(finish)
  return Boolean(message.time?.completed) && isTerminalFinish
}

function shouldPreserveLocalMessage(existing: Message, incoming: Message, isSessionBusy: boolean) {
  if (existing.role !== incoming.role) return false

  if (existing.role === "assistant" && incoming.role === "assistant") {
    if (existing.error && !incoming.error) return true
    if (existing.time?.completed && !incoming.time?.completed) return true

    const existingFinish = existing.finish || ""
    const incomingFinish = incoming.finish || ""
    if (
      existingFinish &&
      !["tool-calls", "unknown"].includes(existingFinish) &&
      existingFinish !== incomingFinish
    ) {
      return true
    }
  }

  return false
}

function shouldPreserveLocalPart(existing: Part, incoming: Part, isSessionBusy: boolean) {
  if (existing.type !== incoming.type) return false

  if ((existing.type === "text" || existing.type === "reasoning") && "text" in incoming) {
    const existingText = existing.text || ""
    const incomingText = incoming.text || ""
    if (isSessionBusy && existingText.length > incomingText.length && existingText.startsWith(incomingText)) {
      return true
    }
  }

  if (existing.type === "tool" && incoming.type === "tool" && existing.tool === incoming.tool) {
    const rank = {
      pending: 0,
      running: 1,
      completed: 2,
      error: 2,
    } as const
    return rank[existing.state.status] > rank[incoming.state.status]
  }

  return false
}

function reducer(state: AgentState, action: Action): AgentState {
  switch (action.type) {
    case "SET_SESSION":
      return {
        ...initialState,
        sessionId: action.sessionId,
      }
    case "RESET":
      return initialState
    case "SET_ERROR":
      return { ...state, error: action.error }
    case "CLEAR_ERROR":
      return { ...state, error: null }
    case "SSE_EVENT": {
      const event = action.event
      switch (event.type) {
        case "message.updated": {
          const msg = event.properties.info
          if (msg.sessionID !== state.sessionId) return state
          return {
            ...state,
            messages: { ...state.messages, [msg.id]: msg },
            messageOrder: upsertMessageOrder(state.messageOrder, msg.id),
            status: isTerminalAssistantMessage(msg) ? { type: "idle" } : state.status,
          }
        }
        case "message.removed": {
          const { sessionID, messageID } = event.properties
          if (sessionID !== state.sessionId) return state
          const { [messageID]: _, ...msgs } = state.messages
          const { [messageID]: __, ...pts } = state.parts
          return {
            ...state,
            messages: msgs,
            messageOrder: state.messageOrder.filter((id) => id !== messageID),
            parts: pts,
          }
        }
        case "message.part.updated": {
          const part = event.properties.part
          if (part.sessionID !== state.sessionId) return state
          const msgParts = state.parts[part.messageID] ?? []
          return {
            ...state,
            parts: {
              ...state.parts,
              [part.messageID]: upsertPart(msgParts, part),
            },
          }
        }
        case "message.part.delta": {
          const { messageID, partID, field, delta } = event.properties
          const messageSessionId = state.messages[messageID]?.sessionID
          if (messageSessionId && messageSessionId !== state.sessionId) return state
          const msgParts = state.parts[messageID]
          if (!msgParts) return state
          return {
            ...state,
            parts: {
              ...state.parts,
              [messageID]: applyDelta(msgParts, partID, field, delta),
            },
          }
        }
        case "message.part.removed": {
          const { messageID, partID } = event.properties
          const messageSessionId = state.messages[messageID]?.sessionID
          if (messageSessionId && messageSessionId !== state.sessionId) return state
          const msgParts = state.parts[messageID]
          if (!msgParts) return state
          const next = removePart(msgParts, partID)
          if (next.length === 0) {
            const { [messageID]: _, ...rest } = state.parts
            return { ...state, parts: rest }
          }
          return {
            ...state,
            parts: { ...state.parts, [messageID]: next },
          }
        }
        case "permission.asked": {
          if (event.properties.sessionID !== state.sessionId) return state
          return { ...state, permission: event.properties }
        }
        case "permission.replied": {
          const sessionID = event.properties?.sessionID
          if (sessionID && sessionID !== state.sessionId) return state
          return { ...state, permission: null }
        }
        case "question.asked": {
          if (event.properties.sessionID !== state.sessionId) return state
          return { ...state, question: event.properties }
        }
        case "question.replied":
        case "question.rejected": {
          const sessionID = event.properties?.sessionID
          if (sessionID && sessionID !== state.sessionId) return state
          return { ...state, question: null }
        }
        case "todo.updated": {
          if (event.properties.sessionID !== state.sessionId) return state
          return { ...state, todos: event.properties.todos }
        }
        case "session.status": {
          const props = event.properties as any
          const sessionID = props?.sessionID ?? props?.sessionId
          if (sessionID !== state.sessionId) return state
          const status = normalizeSessionStatusValue(
            props?.status ?? props?.state ?? props,
          )
          if (!status) return state
          return { ...state, status }
        }
        case "session.idle": {
          const props = event.properties as any
          const sessionID = props?.sessionID ?? props?.sessionId
          if (sessionID !== state.sessionId) return state
          return { ...state, status: { type: "idle" } }
        }
        default:
          return state
      }
    }
    default:
      return state
  }
}

async function api<T = unknown>(
  path: string,
  opts?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...opts?.headers,
    },
  })
  if (!res.ok) {
    const raw = await res.text()
    const isUnreachable =
      res.status === 502 &&
      (raw.includes("opencode server unreachable") ||
        raw.includes("\"error\":\"opencode server unreachable\""))

    if (isUnreachable) {
      let health: AgentHealthPayload | null = null
      try {
        const healthRes = await fetch("/api/agent", { cache: "no-store" })
        if (healthRes.ok) {
          health = (await healthRes.json()) as AgentHealthPayload
        }
      } catch {
        // ignore health check failure
      }

      const err = new Error("opencode server unreachable") as AgentApiError
      err.status = res.status
      err.suppressUserError = true
      err.health = health
      throw err
    }

    throw new Error(`API error ${res.status}: ${raw}`)
  }
  const text = await res.text()
  if (!text) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    const preview = text.trim().slice(0, 80)
    throw new Error(`Invalid JSON response from ${path}: ${preview}`)
  }
}

function pickSessionId(payload: any): string | null {
  const candidates = [
    payload?.id,
    payload?.data?.id,
    payload?.sessionID,
    payload?.data?.sessionID,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate
    }
  }

  return null
}

function normalizeSessionList(payload: any): Session[] {
  if (Array.isArray(payload)) return payload as Session[]
  if (Array.isArray(payload?.sessions)) return payload.sessions as Session[]
  if (Array.isArray(payload?.data)) return payload.data as Session[]
  return []
}

function normalizeSessionMessages(payload: any): Array<{ message: Message; parts: Part[] }> {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.messages)
      ? payload.messages
      : Array.isArray(payload?.data)
        ? payload.data
        : []

  return items
    .map((item: any) => {
      const message = item?.info ?? item?.message ?? null
      const parts = Array.isArray(item?.parts) ? item.parts : []
      return message ? { message, parts } : null
    })
    .filter(Boolean) as Array<{ message: Message; parts: Part[] }>
}

function isSamePayload(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

function isSuppressedApiError(err: unknown): err is AgentApiError {
  return Boolean((err as AgentApiError | undefined)?.suppressUserError)
}

export function useAgentSession(defaultRuntimeConfig?: AgentRuntimeConfig) {
  const [state, dispatch] = useReducer(reducer, initialState)
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
  // When switching sessions intentionally, suppress the brief isConnected=false flicker
  const intentionalSwitchRef = useRef(false)
  const subscribedSessionIdRef = useRef<string | null>(null)
  const sessionListenerReadyRef = useRef<string | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Keep the shared opencode SSE warm even before a session exists.
  useEffect(() => {
    const syncConnection = () => {
      setIsConnected(getOpencodeEventSnapshot().connected)
    }

    syncConnection()
    return subscribeOpencodeSnapshot(syncConnection)
  }, [])

  const handleApiError = useCallback((err: unknown) => {
    if (isSuppressedApiError(err)) {
      // 502/opencode unreachable: silently confirm status via /api/agent and avoid surfacing noisy errors.
      dispatch({ type: "CLEAR_ERROR" })
      if (err.health && err.health.healthy === false) {
        setIsConnected(false)
      }
      return
    }

    const message = err instanceof Error ? err.message : "Unknown error"
    dispatch({ type: "SET_ERROR", error: message })
  }, [])

  const applySessionStatus = useCallback(
    (
      targetSessionId: string,
      status: AgentState["status"] | null | undefined,
    ) => {
      if (!status) return

      if (stateRef.current.sessionId === targetSessionId) {
        stateRef.current = {
          ...stateRef.current,
          status,
        }
      }

      dispatch({
        type: "SSE_EVENT",
        event: {
          type: "session.status",
          properties: {
            sessionID: targetSessionId,
            status,
          },
        },
      })
    },
    [],
  )

  const mergeBufferedPartFields = useCallback((part: Part): Part => {
    const key = `${part.messageID}:${part.id}`
    const buffered = pendingPartDeltasRef.current.get(key)
    knownPartIdsRef.current.add(key)
    if (!buffered) return part

    const next = { ...part } as Part & Record<string, unknown>
    for (const [field, delta] of Object.entries(buffered)) {
      const existing = typeof next[field] === "string" ? String(next[field]) : ""
      if (!existing) {
        next[field] = delta
        continue
      }
      if (
        existing.startsWith(delta) ||
        existing.endsWith(delta) ||
        existing.includes(delta)
      ) {
        next[field] = existing
        continue
      }
      if (delta.endsWith(existing)) {
        next[field] = delta
        continue
      }
      next[field] = `${delta}${existing}`
    }
    pendingPartDeltasRef.current.delete(key)
    return next as Part
  }, [])

  const syncSessionMessages = useCallback(
    async (targetSessionId: string) => {
      const syncEpoch = messageSyncEpochRef.current
      try {
        const payload = await api<any>(`/session/${targetSessionId}/message`)
        if (messageSyncEpochRef.current !== syncEpoch) return
        const items = normalizeSessionMessages(payload)
        const current = stateRef.current
        if (current.sessionId !== targetSessionId) return
        const isSessionBusy =
          current.status.type === "busy" ||
          current.status.type === "retry"

        const seenMessageIds = new Set<string>()
        const optimisticEntries = [...optimisticUserMessagesRef.current.entries()]
          .filter(([, meta]) => meta.sessionId === targetSessionId)
          .sort((a, b) => a[1].createdAt - b[1].createdAt)

        for (const item of items) {
          const msgId = item.message.id
          if (!msgId) continue
          seenMessageIds.add(msgId)

          const existingMessage = current.messages[msgId]
          if (
            (!existingMessage || !isSamePayload(existingMessage, item.message)) &&
            !(existingMessage && shouldPreserveLocalMessage(existingMessage, item.message as Message, isSessionBusy))
          ) {
            dispatch({
              type: "SSE_EVENT",
              event: {
                type: "message.updated",
                properties: { info: item.message as Message },
              },
            })
          }

          const existingParts = current.parts[msgId] ?? []
          const existingById = new Map(existingParts.map((part) => [part.id, part]))
          const seenPartIds = new Set<string>()

          for (const part of item.parts) {
            if (!part?.id) continue
            seenPartIds.add(part.id)
            knownPartIdsRef.current.add(`${part.messageID}:${part.id}`)
            const existingPart = existingById.get(part.id)
            if (
              (!existingPart || !isSamePayload(existingPart, part)) &&
              !(existingPart && shouldPreserveLocalPart(existingPart, part, isSessionBusy))
            ) {
              dispatch({
                type: "SSE_EVENT",
                event: {
                  type: "message.part.updated",
                properties: { part: mergeBufferedPartFields(part) },
              },
            })
          }
          }

          for (const existingPart of existingParts) {
            if (isSessionBusy) continue
            if (!seenPartIds.has(existingPart.id)) {
              dispatch({
                type: "SSE_EVENT",
                event: {
                  type: "message.part.removed",
                  properties: {
                    sessionID: targetSessionId,
                    messageID: msgId,
                    partID: existingPart.id,
                  },
                },
              })
            }
          }

          if (item.message.role === "user" && optimisticEntries.length > 0) {
            const userText = pickVisibleUserText(item.parts)
            if (userText) {
              const matchIdx = optimisticEntries.findIndex(
                ([, meta]) => meta.text === userText,
              )
              if (matchIdx >= 0) {
                const [optimisticId] = optimisticEntries.splice(matchIdx, 1)[0]
                optimisticUserMessagesRef.current.delete(optimisticId)
                if (optimisticId !== msgId) {
                  dispatch({
                    type: "SSE_EVENT",
                    event: {
                      type: "message.removed",
                      properties: {
                        sessionID: targetSessionId,
                        messageID: optimisticId,
                      },
                    },
                  })
                }
              }
            }
          }
        }

        for (const messageId of current.messageOrder) {
          if (isSessionBusy) break
          const msg = current.messages[messageId]
          if (!msg || msg.sessionID !== targetSessionId) continue
          if (optimisticUserMessagesRef.current.has(messageId)) continue
          if (seenMessageIds.has(messageId)) continue
          dispatch({
            type: "SSE_EVENT",
            event: {
              type: "message.removed",
              properties: {
                sessionID: targetSessionId,
                messageID: messageId,
              },
            },
          })
        }
      } catch (err) {
        if (isSuppressedApiError(err)) {
          dispatch({ type: "CLEAR_ERROR" })
          if (err.health && err.health.healthy === false) {
            setIsConnected(false)
          }
        }
      }
    },
    [mergeBufferedPartFields],
  )

  const refreshSessionStatus = useCallback(
    async (targetSessionId: string, options?: { force?: boolean }) => {
      try {
        if (options?.force || Object.keys(getOpencodeEventSnapshot().statuses).length === 0) {
          await refreshOpencodeStatusSnapshot()
        }

        const snapshot = getOpencodeEventSnapshot().statuses
        applySessionStatus(targetSessionId, snapshot[targetSessionId])
      } catch (err) {
        // Background status sync should be silent; only downgrade connection on known unreachable states.
        if (isSuppressedApiError(err)) {
          dispatch({ type: "CLEAR_ERROR" })
          if (err.health && err.health.healthy === false) {
            setIsConnected(false)
          }
        }
      }
    },
    [applySessionStatus],
  )

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
  }, [])

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
  }, [syncSessionMessages])

  const submitPrompt = useCallback(async (
    sessionId: string,
    text: string,
    options?: {
      existingMessageId?: string
      alreadyOptimistic?: boolean
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
      bootstrapAssistantStream(sessionId)
      scheduleSessionResync(sessionId)
      void refreshSessionStatus(sessionId, { force: true })
      return true
    } catch (err) {
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
      if ((err as any)?.name !== "AbortError") {
        handleApiError(err)
      }
      return false
    }
  }, [
    createOptimisticUserMessage,
    defaultRuntimeConfig,
    bootstrapAssistantStream,
    handleApiError,
    refreshSessionStatus,
    scheduleSessionResync,
  ])

  const isBusy =
    state.status.type === "busy" ||
    state.status.type === "retry"

  useEffect(() => {
    const previous = previousStatusRef.current
    previousStatusRef.current = state.status

    if (!state.sessionId) return

    const wasBusy = previous.type === "busy" || previous.type === "retry"
    const nowBusy = state.status.type === "busy" || state.status.type === "retry"
    if (!wasBusy || nowBusy) return

    void syncSessionMessages(state.sessionId)
  }, [state.sessionId, state.status, syncSessionMessages])

  // Workspace event stream
  useEffect(() => {
    if (!state.sessionId) {
      pendingPartDeltasRef.current.clear()
      knownPartIdsRef.current.clear()
      subscribedSessionIdRef.current = null
      sessionListenerReadyRef.current = null
      setIsConnected(getOpencodeEventSnapshot().connected)
      return
    }
    const activeSessionId = state.sessionId
    subscribedSessionIdRef.current = activeSessionId
    intentionalSwitchRef.current = false
    setIsConnected(getOpencodeEventSnapshot().connected)
    void syncSessionMessages(activeSessionId)
    void refreshSessionStatus(activeSessionId, { force: true })

    const unsubscribeSnapshot = subscribeOpencodeSnapshot(() => {
      const snapshot = getOpencodeEventSnapshot()
      setIsConnected(snapshot.connected)
      applySessionStatus(activeSessionId, snapshot.statuses[activeSessionId])
    })

    const unsubscribeEvents = subscribeOpencodeEvents((event) => {
      if (event.type === "server.connected") {
        dispatch({ type: "CLEAR_ERROR" })
        const current = stateRef.current
        const currentlyBusy =
          current.sessionId === activeSessionId &&
          (current.status.type === "busy" || current.status.type === "retry")
        if (!currentlyBusy) {
          void syncSessionMessages(activeSessionId)
        }
        void refreshSessionStatus(activeSessionId, { force: true })
        return
      }

      if (event.type === "message.part.delta") {
        const props = event.properties as {
          messageID: string
          partID: string
          field: string
          delta: string
        }
        const partKey = `${props.messageID}:${props.partID}`
        const hasPart = knownPartIdsRef.current.has(partKey)
        if (!hasPart) {
          const existing = pendingPartDeltasRef.current.get(partKey) || {}
          pendingPartDeltasRef.current.set(partKey, {
            ...existing,
            [props.field]: `${existing[props.field] || ""}${props.delta}`,
          })
          return
        }
      }

      if (event.type === "message.part.updated") {
        const props = event.properties as { part: Part }
        knownPartIdsRef.current.add(`${props.part.messageID}:${props.part.id}`)
        dispatch({
          type: "SSE_EVENT",
          event: {
            ...event,
            properties: {
              ...event.properties,
              part: mergeBufferedPartFields(props.part),
            },
          } as SSEEvent,
        })
        return
      }

      if (event.type === "message.part.removed") {
        const props = event.properties as { messageID: string; partID: string }
        const key = `${props.messageID}:${props.partID}`
        pendingPartDeltasRef.current.delete(key)
        knownPartIdsRef.current.delete(key)
      }

      if (event.type === "message.removed") {
        const props = event.properties as { messageID: string }
        for (const key of pendingPartDeltasRef.current.keys()) {
          if (key.startsWith(`${props.messageID}:`)) {
            pendingPartDeltasRef.current.delete(key)
          }
        }
        for (const key of knownPartIdsRef.current) {
          if (key.startsWith(`${props.messageID}:`)) {
            knownPartIdsRef.current.delete(key)
          }
        }
      }

      dispatch({ type: "SSE_EVENT", event: event as SSEEvent })
    })

    sessionListenerReadyRef.current = activeSessionId

    return () => {
      if (subscribedSessionIdRef.current === activeSessionId) {
        subscribedSessionIdRef.current = null
      }
      if (sessionListenerReadyRef.current === activeSessionId) {
        sessionListenerReadyRef.current = null
      }
      unsubscribeEvents()
      unsubscribeSnapshot()
      if (!intentionalSwitchRef.current) setIsConnected(false)
    }
  }, [applySessionStatus, refreshSessionStatus, state.sessionId, syncSessionMessages])

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
      messageSyncEpochRef.current += 1
      pendingPartDeltasRef.current.clear()
      knownPartIdsRef.current.clear()
      optimisticUserMessagesRef.current.clear()
      setPendingPrompts([])
      stateRef.current = {
        ...initialState,
        sessionId,
      }
      dispatch({ type: "SET_SESSION", sessionId })
    } catch (err) {
      handleApiError(err)
    }
  }, [handleApiError])

  const resetSession = useCallback(() => {
    intentionalSwitchRef.current = true
    messageSyncEpochRef.current += 1
    pendingPartDeltasRef.current.clear()
    knownPartIdsRef.current.clear()
    optimisticUserMessagesRef.current.clear()
    setPendingPrompts([])
    stateRef.current = initialState
    dispatch({ type: "RESET" })
  }, [])

  const loadSession = useCallback(async (sessionId: string) => {
    intentionalSwitchRef.current = true
    messageSyncEpochRef.current += 1
    pendingPartDeltasRef.current.clear()
    knownPartIdsRef.current.clear()
    optimisticUserMessagesRef.current.clear()
    setPendingPrompts([])
    stateRef.current = {
      ...initialState,
      sessionId,
    }
    dispatch({ type: "SET_SESSION", sessionId })
  }, [])

  const waitForSessionSubscription = useCallback(async (sessionId: string) => {
    const deadline = Date.now() + 1500
    while (
      (subscribedSessionIdRef.current !== sessionId ||
        sessionListenerReadyRef.current !== sessionId) &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => window.setTimeout(resolve, 16))
    }
  }, [])

  const sendMessage = useCallback(
    async (text: string, runtimeConfig?: AgentRuntimeConfig) => {
      let sessionId = stateRef.current.sessionId
      let createdSession = false
      const trimmed = text.trim()
      if (!trimmed) return
      // Lazily create a session if we don't have one yet
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
          messageSyncEpochRef.current += 1
          pendingPartDeltasRef.current.clear()
          knownPartIdsRef.current.clear()
          setPendingPrompts([])
          stateRef.current = {
            ...initialState,
            sessionId,
          }
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
        const optimistic = createOptimisticUserMessage(sessionId, trimmed, runtimeConfig)
        setPendingPrompts((prev) => [
          ...prev,
          {
            id: optimistic.messageId,
            sessionId,
            text: trimmed,
            createdAt: optimistic.createdAt,
            runtimeConfig,
          },
        ])
        dispatch({ type: "CLEAR_ERROR" })
        return
      }

      await submitPrompt(sessionId, trimmed, { runtimeConfig })
    },
    [createOptimisticUserMessage, handleApiError, submitPrompt, waitForSessionSubscription],
  )

  const abort = useCallback(async () => {
    abortRef.current?.abort()
    if (!state.sessionId) return
    try {
      await api(`/session/${state.sessionId}/abort`, { method: "POST" })
    } catch {
      // ignore
    }
  }, [state.sessionId])

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
    [state.sessionId, state.permission, handleApiError],
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
    [state.sessionId, state.question, handleApiError],
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
  }, [state.sessionId, state.question, handleApiError])

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

  // Regenerate from a specific assistant message.
  // If no targetMessageId is provided, regenerates the last assistant message.
  // Deletes the target assistant message and all subsequent messages, then re-sends the preceding user message.
  const regenerate = useCallback(async (targetMessageId?: string) => {
    if (!state.sessionId) return

    const { messageOrder, messages } = state

    // Find the target assistant message index
    let targetIdx = -1
    if (targetMessageId) {
      targetIdx = messageOrder.indexOf(targetMessageId)
    } else {
      // Find the last assistant message
      for (let i = messageOrder.length - 1; i >= 0; i--) {
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

    // Find the user message before the target assistant message
    let userText: string | null = null
    let userMsgIdx = -1
    let userRuntimeConfig: AgentRuntimeConfig | undefined
    for (let i = targetIdx - 1; i >= 0; i--) {
      const msg = messages[messageOrder[i]]
      if (msg?.role === "user") {
        // Extract text from user message parts
        const userParts = state.parts[messageOrder[i]] || []
        const textPart = userParts.find((p: any) => p.type === "text")
        userText = (textPart as any)?.text || null
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

    // Collect all message IDs from the user message onwards (inclusive: user + assistant + all below)
    const toDelete = messageOrder.slice(userMsgIdx)

    // Delete all messages from the API (from last to first to avoid ordering issues)
    try {
      for (let i = toDelete.length - 1; i >= 0; i--) {
        const msgId = toDelete[i]
        await api(`/session/${state.sessionId}/message/${msgId}`, {
          method: "DELETE",
        })
        // Dispatch local removal
        dispatch({
          type: "SSE_EVENT",
          event: {
            type: "message.removed",
            properties: { sessionID: state.sessionId!, messageID: msgId },
          },
        })
      }
    } catch (err) {
      handleApiError(err)
      return
    }

    // Re-send the user message to trigger regeneration
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
      if ((err as any)?.name !== "AbortError") {
        const now = Date.now()
        const localId = `local-err-${now}`
        dispatch({
          type: "SSE_EVENT",
          event: {
            type: "message.updated",
            properties: {
              info: {
                id: localId,
                sessionID: state.sessionId!,
                role: "user",
                time: { created: now },
                agent: "user",
                model: { providerID: "unknown", modelID: "unknown" },
              }
            }
          }
        })
        dispatch({
          type: "SSE_EVENT",
          event: {
            type: "message.part.updated",
            properties: {
              part: {
                id: `part-${now}`,
                sessionID: state.sessionId!,
                messageID: localId,
                type: "text",
                text: `${userText}\n\n[系統提示：網路錯誤導致重新生成失敗，請複製以上文字並手動重試]`,
              }
            }
          }
        })
        handleApiError(err)
      }
    }
  }, [
    defaultRuntimeConfig,
    state.sessionId,
    state.messageOrder,
    state.messages,
    state.parts,
    handleApiError,
    submitPrompt,
  ])

  useEffect(() => {
    if (!state.sessionId || isBusy || pendingPrompts.length === 0 || queueDrainRef.current) {
      return
    }

    const next = pendingPrompts[0]
    if (next.sessionId !== state.sessionId) {
      setPendingPrompts((prev) => prev.filter((item) => item.sessionId === state.sessionId))
      return
    }

    queueDrainRef.current = true
    setPendingPrompts((prev) => prev.slice(1))
    void submitPrompt(state.sessionId, next.text, {
      existingMessageId: next.id,
      alreadyOptimistic: true,
      runtimeConfig: next.runtimeConfig,
    }).finally(() => {
      queueDrainRef.current = false
    })
  }, [isBusy, pendingPrompts, state.sessionId, submitPrompt])

  return {
    state,
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
    isConnected,
    isBusy,
    pendingPrompts,
  }
}
