import type { AgentState, Message, Part, SSEEvent } from "./types"
import { normalizeSessionStatusValue } from "./agent-session-helpers"

export const initialState: AgentState = {
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

export type AgentSessionAction =
  | { type: "SET_SESSION"; sessionId: string }
  | { type: "RESET" }
  | { type: "SET_ERROR"; error: string }
  | { type: "CLEAR_ERROR" }
  | { type: "SSE_EVENT"; event: SSEEvent }

function upsertMessageOrder(order: string[], id: string): string[] {
  if (order.includes(id)) return order
  return [...order, id]
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
  const part = { ...next[idx] } as Part & Record<string, unknown>
  part[field] = `${typeof part[field] === "string" ? part[field] : ""}${delta}`
  next[idx] = part as Part
  return next
}

function isTerminalAssistantMessage(message: Message): boolean {
  if (message.role !== "assistant") return false
  if (message.error) return true

  const finish = typeof message.finish === "string" ? message.finish : ""
  const isTerminalFinish = Boolean(finish) && !["tool-calls", "unknown"].includes(finish)
  return Boolean(message.time?.completed) && isTerminalFinish
}

export function agentSessionReducer(state: AgentState, action: AgentSessionAction): AgentState {
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
