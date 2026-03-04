// ─── Agent SSE Types ─────────────────────────────────────────────────

export type ToolStatus = "pending" | "running" | "completed" | "error"

export type AgentTextPart = {
  type: "text"
  id: string
  text: string
}

export type AgentReasoningPart = {
  type: "reasoning"
  id: string
  text: string
}

export type AgentToolPart = {
  type: "tool"
  id: string
  tool: string
  metadata?: Record<string, unknown>
  state: {
    status: ToolStatus
    input?: Record<string, unknown>
    title?: string
    metadata?: Record<string, unknown>
    output?: string
    error?: string
    raw?: string
  }
}

export type AgentStepFinishPart = {
  type: "step-finish"
  id: string
}

export type AgentPart = AgentTextPart | AgentReasoningPart | AgentToolPart | AgentStepFinishPart

export type AgentMessage = {
  id: string
  sessionID: string
  role: "user" | "assistant"
  format?: string
  time?: { created?: number; completed?: number } | string
  finish?: string
  error?: string
}

export type AgentSessionStatus = {
  sessionID: string
  status: "idle" | "busy" | "retry"
  attempt?: number
}

export type PermissionRequest = {
  id: string
  sessionID: string
  permission: string
  patterns: string[]
  metadata: Record<string, unknown>
  always: string[]
  tool?: {
    messageID: string
    callID: string
  }
}

export type QuestionOption = {
  label: string
  description: string
}

export type QuestionInfo = {
  question: string
  header: string
  options: QuestionOption[]
  multiple?: boolean
  custom?: boolean
}

export type QuestionRequest = {
  id: string
  sessionID: string
  questions: QuestionInfo[]
  tool?: {
    messageID: string
    callID: string
  }
}

// ─── SSE Events ──────────────────────────────────────────────────────

export type SSEEventMessageUpdated = {
  type: "message.updated"
  properties: {
    sessionID: string
    info: AgentMessage
  }
}

export type SSEEventMessageRemoved = {
  type: "message.removed"
  properties: {
    sessionID: string
    messageID: string
  }
}

export type SSEEventPartUpdated = {
  type: "message.part.updated"
  properties: {
    sessionID: string
    messageID: string
    part: AgentPart
  }
}

export type SSEEventPartRemoved = {
  type: "message.part.removed"
  properties: {
    sessionID: string
    messageID: string
    partID: string
  }
}

export type SSEEventPartDelta = {
  type: "message.part.delta"
  properties: {
    sessionID: string
    messageID: string
    partID: string
    field: string
    delta: string
  }
}

export type SSEEventSessionStatus = {
  type: "session.status"
  properties: AgentSessionStatus
}

export type SSEEventPermissionAsked = {
  type: "permission.asked"
  properties: PermissionRequest
}

export type SSEEventPermissionReplied = {
  type: "permission.replied"
  properties: { id: string; sessionID: string }
}

export type SSEEventQuestionAsked = {
  type: "question.asked"
  properties: QuestionRequest
}

export type SSEEventQuestionReplied = {
  type: "question.replied"
  properties: { requestID: string; sessionID: string; answers: string[][] }
}

export type SSEEventQuestionRejected = {
  type: "question.rejected"
  properties: { requestID: string; sessionID: string }
}

export type AgentSSEEvent =
  | SSEEventMessageUpdated
  | SSEEventMessageRemoved
  | SSEEventPartUpdated
  | SSEEventPartRemoved
  | SSEEventPartDelta
  | SSEEventSessionStatus
  | SSEEventPermissionAsked
  | SSEEventPermissionReplied
  | SSEEventQuestionAsked
  | SSEEventQuestionReplied
  | SSEEventQuestionRejected
