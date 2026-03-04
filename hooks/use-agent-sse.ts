"use client"

import { useEffect, useRef, useState } from "react"
import type { AgentSSEEvent } from "@/lib/agent/types"

const HEARTBEAT_TIMEOUT = 30_000
const MAX_BACKOFF = 16_000
const INITIAL_BACKOFF = 1_000
const NAMED_EVENT_TYPES = [
  "server.connected",
  "server.heartbeat",
  "session.status",
  "message.updated",
  "message.removed",
  "message.part.updated",
  "message.part.removed",
  "message.part.delta",
  "permission.asked",
  "permission.replied",
  "question.asked",
  "question.replied",
  "question.rejected",
] as const

export function useAgentSSE(options: {
  enabled: boolean
  onEvent: (event: AgentSSEEvent) => void
  onReconnect?: () => void
  instanceUrl?: string
}): { connected: boolean } {
  const { enabled, onEvent, onReconnect, instanceUrl } = options
  const [connected, setConnected] = useState(false)

  // Stable refs so the EventSource callbacks always see the latest handlers
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const onReconnectRef = useRef(onReconnect)
  onReconnectRef.current = onReconnect

  useEffect(() => {
    if (!enabled) {
      setConnected(false)
      return
    }

    let es: EventSource | null = null
    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let backoff = INITIAL_BACKOFF
    let disposed = false
    let hasConnectedOnce = false
    let messageHandler: ((ev: MessageEvent) => void) | null = null

    const clearTimers = () => {
      if (heartbeatTimer) { clearTimeout(heartbeatTimer); heartbeatTimer = null }
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    }

    const resetHeartbeat = () => {
      if (heartbeatTimer) clearTimeout(heartbeatTimer)
      heartbeatTimer = setTimeout(() => {
        // No event in 30s — reconnect
        if (!disposed) reconnect()
      }, HEARTBEAT_TIMEOUT)
    }

    const reconnect = () => {
      if (disposed) return
      cleanup()
      reconnectTimer = setTimeout(() => {
        if (disposed) return
        if (hasConnectedOnce) {
          onReconnectRef.current?.()
        }
        connect()
      }, backoff)
      backoff = Math.min(backoff * 2, MAX_BACKOFF)
    }

    const cleanup = () => {
      if (es) {
        if (messageHandler) {
          for (const eventType of NAMED_EVENT_TYPES) {
            es.removeEventListener(eventType, messageHandler as EventListener)
          }
          messageHandler = null
        }
        es.onopen = null
        es.onmessage = null
        es.onerror = null
        es.close()
        es = null
      }
      clearTimers()
      setConnected(false)
    }

    const connect = () => {
      if (disposed) return
      const url = instanceUrl
        ? `/api/agent/events${instanceUrl}`
        : "/api/agent/events"
      es = new EventSource(url)

      es.onopen = () => {
        if (disposed) return
        setConnected(true)
        backoff = INITIAL_BACKOFF
        hasConnectedOnce = true
        resetHeartbeat()
      }

      messageHandler = (ev: MessageEvent) => {
        if (disposed) return
        resetHeartbeat()
        if (!ev.data) return
        try {
          const parsed = JSON.parse(ev.data)
          // OpenCode SSE wraps events as { directory, payload: { type, properties } }
          // but may also send flat { type, properties } depending on endpoint
          const event = parsed?.payload?.type
            ? parsed.payload
            : parsed?.type
              ? parsed
              : null
          if (event) {
            onEventRef.current(event as AgentSSEEvent)
          }
        } catch {
          // ignore unparseable events (heartbeats, etc.)
        }
      }
      es.onmessage = messageHandler
      for (const eventType of NAMED_EVENT_TYPES) {
        es.addEventListener(eventType, messageHandler as EventListener)
      }

      es.onerror = () => {
        if (disposed) return
        setConnected(false)
        reconnect()
      }
    }

    connect()

    return () => {
      disposed = true
      cleanup()
    }
  }, [enabled, instanceUrl])

  return { connected }
}
