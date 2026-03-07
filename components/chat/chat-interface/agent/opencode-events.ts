"use client"

import type { SessionStatus } from "./types"

const API_BASE = "/api/agent/opencode"

export type OpencodeEvent = {
  type: string
  properties?: any
}

type Snapshot = {
  connected: boolean
  statuses: Record<string, SessionStatus>
}

const snapshot: Snapshot = {
  connected: false,
  statuses: {},
}

const stateListeners = new Set<() => void>()
const eventListeners = new Set<(event: OpencodeEvent) => void>()

let refCount = 0
let eventSource: EventSource | null = null
let refreshPromise: Promise<void> | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null
let lastFlushAt = 0
let queuedEvents: OpencodeEvent[] = []
let bufferEvents: OpencodeEvent[] = []
const coalescedKeys = new Map<string, number>()
const staleDeltas = new Set<string>()

const FLUSH_FRAME_MS = 16

function emitState() {
  stateListeners.forEach((listener) => listener())
}

function deltaKey(sessionId: string, messageId: string, partId: string) {
  return `${sessionId}:${messageId}:${partId}`
}

function eventKey(event: OpencodeEvent): string | null {
  if (event.type === "session.status") {
    const props = event.properties as Record<string, unknown> | undefined
    const sessionId = String(props?.sessionID ?? props?.sessionId ?? "")
    return sessionId ? `session.status:${sessionId}` : null
  }

  if (event.type === "message.part.updated") {
    const part = (event.properties as {
      part?: {
        sessionID?: string
        messageID?: string
        id?: string
        type?: string
      }
    } | undefined)?.part
    if (!part?.sessionID || !part?.messageID || !part?.id) return null
    if (part.type === "text" || part.type === "reasoning") return null
    return `message.part.updated:${part.sessionID}:${part.messageID}:${part.id}`
  }

  return null
}

function normalizeIncomingEvent(input: unknown): OpencodeEvent | null {
  if (!input || typeof input !== "object") return null
  const record = input as Record<string, unknown>
  const payload =
    record.payload && typeof record.payload === "object"
      ? (record.payload as Record<string, unknown>)
      : record
  if (typeof payload.type !== "string") return null
  return payload as OpencodeEvent
}

function normalizeSessionStatusValue(input: unknown): SessionStatus | null {
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

function replaceStatuses(nextStatuses: Record<string, SessionStatus>) {
  snapshot.statuses = nextStatuses
  emitState()
}

function updateStatus(sessionId: string, nextStatus: SessionStatus | null) {
  const prev = snapshot.statuses[sessionId]

  if (!nextStatus) {
    if (!prev) return
    const next = { ...snapshot.statuses }
    delete next[sessionId]
    replaceStatuses(next)
    return
  }

  const same =
    prev &&
    prev.type === nextStatus.type &&
    JSON.stringify(prev) === JSON.stringify(nextStatus)
  if (same) return

  replaceStatuses({
    ...snapshot.statuses,
    [sessionId]: nextStatus,
  })
}

function applyEvent(event: OpencodeEvent) {
  if (event.type === "server.connected") {
    snapshot.connected = true
    emitState()
    void refreshOpencodeStatusSnapshot()
    return
  }

  if (event.type === "session.status") {
    const props = event.properties as Record<string, unknown> | undefined
    const sessionId = String(props?.sessionID ?? props?.sessionId ?? "")
    if (!sessionId) return
    updateStatus(
      sessionId,
      normalizeSessionStatusValue(props?.status ?? props?.state ?? props),
    )
    return
  }

  if (event.type === "session.idle") {
    const props = event.properties as Record<string, unknown> | undefined
    const sessionId = String(props?.sessionID ?? props?.sessionId ?? "")
    if (!sessionId) return
    updateStatus(sessionId, { type: "idle" })
    return
  }

  if (event.type === "session.deleted") {
    const info = (event.properties as { info?: { id?: string } } | undefined)?.info
    if (!info?.id) return
    updateStatus(info.id, null)
  }
}

function flushQueuedEvents() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (queuedEvents.length === 0) return

  const events = queuedEvents
  const skip = staleDeltas.size > 0 ? new Set(staleDeltas) : undefined
  queuedEvents = bufferEvents
  bufferEvents = events
  queuedEvents.length = 0
  coalescedKeys.clear()
  staleDeltas.clear()
  lastFlushAt = Date.now()

  for (const event of events) {
    if (skip && event.type === "message.part.delta") {
      const props = event.properties as
        | { sessionID?: string; messageID?: string; partID?: string }
        | undefined
      const sessionId = String(props?.sessionID ?? "")
      if (
        sessionId &&
        props?.messageID &&
        props?.partID &&
        skip.has(deltaKey(sessionId, props.messageID, props.partID))
      ) {
        continue
      }
    }

    applyEvent(event)
    eventListeners.forEach((listener) => listener(event))
  }

  bufferEvents.length = 0
}

function scheduleFlush() {
  if (flushTimer) return
  const elapsed = Date.now() - lastFlushAt
  flushTimer = setTimeout(flushQueuedEvents, Math.max(0, FLUSH_FRAME_MS - elapsed))
}

function enqueueEvent(event: OpencodeEvent) {
  const key = eventKey(event)
  if (key) {
    const index = coalescedKeys.get(key)
    if (typeof index === "number") {
      queuedEvents[index] = event
      if (event.type === "message.part.updated") {
        const part = (event.properties as { part: { sessionID: string; messageID: string; id: string } }).part
        staleDeltas.add(deltaKey(part.sessionID, part.messageID, part.id))
      }
      scheduleFlush()
      return
    }

    coalescedKeys.set(key, queuedEvents.length)
  }

  queuedEvents.push(event)
  scheduleFlush()
}

function retainConnection() {
  refCount += 1
  ensureConnection()
}

function releaseConnection() {
  refCount = Math.max(0, refCount - 1)
  if (refCount > 0) return
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
  flushQueuedEvents()
  if (snapshot.connected) {
    snapshot.connected = false
    emitState()
  }
}

function ensureConnection() {
  if (typeof window === "undefined" || eventSource) return

  const source = new EventSource(`${API_BASE}/event`)
  eventSource = source

  source.onopen = () => {
    if (!snapshot.connected) {
      snapshot.connected = true
      emitState()
    }
    void refreshOpencodeStatusSnapshot()
  }

  source.onmessage = (message) => {
    if (!message.data) return

    try {
      const parsed = JSON.parse(message.data)
      const event = normalizeIncomingEvent(parsed)
      if (!event) return
      enqueueEvent(event)
    } catch {
      // Ignore malformed events.
    }
  }

  source.onerror = () => {
    if (!snapshot.connected) return
    snapshot.connected = false
    emitState()
  }
}

export function getOpencodeEventSnapshot(): Snapshot {
  return {
    connected: snapshot.connected,
    statuses: { ...snapshot.statuses },
  }
}

export function subscribeOpencodeSnapshot(listener: () => void) {
  stateListeners.add(listener)
  retainConnection()
  return () => {
    stateListeners.delete(listener)
    releaseConnection()
  }
}

export function subscribeOpencodeEvents(listener: (event: OpencodeEvent) => void) {
  eventListeners.add(listener)
  retainConnection()
  return () => {
    eventListeners.delete(listener)
    releaseConnection()
  }
}

export async function refreshOpencodeStatusSnapshot() {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/session/status`, { cache: "no-store" })
      if (!res.ok) return

      const payload = await res.json()
      const root =
        (payload?.data && typeof payload.data === "object" ? payload.data : null) ||
        (payload && typeof payload === "object" ? payload : null)

      if (!root) {
        replaceStatuses({})
        return
      }

      const next: Record<string, SessionStatus> = {}
      for (const [sessionId, status] of Object.entries(root as Record<string, unknown>)) {
        const normalized = normalizeSessionStatusValue(status)
        if (normalized) next[sessionId] = normalized
      }

      replaceStatuses(next)
    } catch {
      // Ignore bootstrap failures; SSE reconnect will retry.
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}
