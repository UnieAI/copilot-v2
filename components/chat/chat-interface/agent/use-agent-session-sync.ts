"use client"

import { useCallback, useEffect } from "react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import {
  getOpencodeEventSnapshot,
  refreshOpencodeStatusSnapshot,
  subscribeOpencodeEvents,
  subscribeOpencodeSnapshot,
} from "./opencode-events"
import { isSuppressedApiError, normalizeSessionMessages, api, isSamePayload } from "./agent-session-api"
import {
  pickVisibleUserText,
  shouldPreserveLocalMessage,
  shouldPreserveLocalPart,
} from "./agent-session-helpers"
import type { OptimisticUserMessage } from "./agent-session-internal-types"
import type { AgentSessionAction } from "./agent-session-state"
import type { AgentState, Part, SSEEvent } from "./types"

type DeltaBuffer = Map<string, Record<string, string>>

export function useAgentSessionSync({
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
}: {
  state: AgentState
  dispatch: Dispatch<AgentSessionAction>
  stateRef: MutableRefObject<AgentState>
  previousStatusRef: MutableRefObject<AgentState["status"]>
  pendingPartDeltasRef: MutableRefObject<DeltaBuffer>
  knownPartIdsRef: MutableRefObject<Set<string>>
  messageSyncEpochRef: MutableRefObject<number>
  optimisticUserMessagesRef: MutableRefObject<Map<string, OptimisticUserMessage>>
  intentionalSwitchRef: MutableRefObject<boolean>
  subscribedSessionIdRef: MutableRefObject<string | null>
  sessionListenerReadyRef: MutableRefObject<string | null>
  setIsConnected: Dispatch<SetStateAction<boolean>>
}) {
  useEffect(() => {
    const syncConnection = () => {
      setIsConnected(getOpencodeEventSnapshot().connected)
    }

    syncConnection()
    return subscribeOpencodeSnapshot(syncConnection)
  }, [setIsConnected])

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
    [dispatch, stateRef],
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
  }, [knownPartIdsRef, pendingPartDeltasRef])

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
            !(existingMessage && shouldPreserveLocalMessage(existingMessage, item.message))
          ) {
            dispatch({
              type: "SSE_EVENT",
              event: {
                type: "message.updated",
                properties: { info: item.message },
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
    [
      dispatch,
      knownPartIdsRef,
      mergeBufferedPartFields,
      messageSyncEpochRef,
      optimisticUserMessagesRef,
      setIsConnected,
      stateRef,
    ],
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
        if (isSuppressedApiError(err)) {
          dispatch({ type: "CLEAR_ERROR" })
          if (err.health && err.health.healthy === false) {
            setIsConnected(false)
          }
        }
      }
    },
    [applySessionStatus, dispatch, setIsConnected],
  )

  useEffect(() => {
    const previous = previousStatusRef.current
    previousStatusRef.current = state.status

    if (!state.sessionId) return

    const wasBusy = previous.type === "busy" || previous.type === "retry"
    const nowBusy = state.status.type === "busy" || state.status.type === "retry"
    if (!wasBusy || nowBusy) return

    void syncSessionMessages(state.sessionId)
  }, [previousStatusRef, state.sessionId, state.status, syncSessionMessages])

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
  }, [
    applySessionStatus,
    dispatch,
    intentionalSwitchRef,
    knownPartIdsRef,
    mergeBufferedPartFields,
    pendingPartDeltasRef,
    refreshSessionStatus,
    sessionListenerReadyRef,
    setIsConnected,
    state.sessionId,
    stateRef,
    subscribedSessionIdRef,
    syncSessionMessages,
  ])

  return {
    syncSessionMessages,
    refreshSessionStatus,
  }
}
