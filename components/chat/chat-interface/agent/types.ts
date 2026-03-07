// opencode agent types — ported from opencode SDK types.gen.ts

export type Session = {
  id: string
  slug: string
  projectID: string
  title: string
  version: string
  parentID?: string
  time: {
    created: number
    updated: number
  }
}

export type UserMessage = {
  id: string
  sessionID: string
  role: "user"
  time: { created: number }
  agent: string
  model: { providerID: string; modelID: string }
  variant?: string
}

export type AssistantMessage = {
  id: string
  sessionID: string
  role: "assistant"
  time: { created: number; completed?: number }
  parentID: string
  modelID: string
  providerID: string
  mode: string
  agent: string
  path: { cwd: string; root: string }
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: { read: number; write: number }
  }
  error?: {
    name: string
    data: Record<string, unknown>
  }
  variant?: string
  finish?: string
}

export type Message = UserMessage | AssistantMessage

// Parts
export type TextPart = {
  id: string
  sessionID: string
  messageID: string
  type: "text"
  text: string
  synthetic?: boolean
}

export type ReasoningPart = {
  id: string
  sessionID: string
  messageID: string
  type: "reasoning"
  text: string
  time: { start: number; end?: number }
}

export type ToolStatePending = {
  status: "pending"
  input: Record<string, unknown>
  raw: string
}

export type ToolStateRunning = {
  status: "running"
  input: Record<string, unknown>
  title?: string
  metadata?: Record<string, unknown>
  time: { start: number }
}

export type ToolStateCompleted = {
  status: "completed"
  input: Record<string, unknown>
  output: string
  title: string
  metadata: Record<string, unknown>
  time: { start: number; end: number }
}

export type ToolStateError = {
  status: "error"
  input: Record<string, unknown>
  error: string
  metadata?: Record<string, unknown>
  time: { start: number; end: number }
}

export type ToolState =
  | ToolStatePending
  | ToolStateRunning
  | ToolStateCompleted
  | ToolStateError

export type ToolPart = {
  id: string
  sessionID: string
  messageID: string
  type: "tool"
  callID: string
  tool: string
  state: ToolState
}

export type SubtaskPart = {
  id: string
  sessionID: string
  messageID: string
  type: "subtask"
  prompt: string
  description: string
  agent: string
}

export type FilePart = {
  id: string
  sessionID: string
  messageID: string
  type: "file"
  mime: string
  filename?: string
  url: string
}

export type StepStartPart = {
  id: string
  sessionID: string
  messageID: string
  type: "step-start"
}

export type StepFinishPart = {
  id: string
  sessionID: string
  messageID: string
  type: "step-finish"
  reason: string
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: { read: number; write: number }
  }
}

export type SnapshotPart = {
  id: string
  sessionID: string
  messageID: string
  type: "snapshot"
  snapshot: string
}

export type PatchPart = {
  id: string
  sessionID: string
  messageID: string
  type: "patch"
  hash: string
  files: string[]
}

export type AgentPart = {
  id: string
  sessionID: string
  messageID: string
  type: "agent"
  name: string
}

export type RetryPart = {
  id: string
  sessionID: string
  messageID: string
  type: "retry"
  attempt: number
  error: { name: string; data: Record<string, unknown> }
  time: { created: number }
}

export type CompactionPart = {
  id: string
  sessionID: string
  messageID: string
  type: "compaction"
  auto: boolean
}

export type Part =
  | TextPart
  | ReasoningPart
  | ToolPart
  | SubtaskPart
  | FilePart
  | StepStartPart
  | StepFinishPart
  | SnapshotPart
  | PatchPart
  | AgentPart
  | RetryPart
  | CompactionPart

// Session status
export type SessionStatus =
  | { type: "idle" }
  | { type: "retry"; attempt: number; message: string; next: number }
  | { type: "busy" }

// Permission
export type PermissionRequest = {
  id: string
  sessionID: string
  permission: string
  patterns: string[]
  metadata: Record<string, unknown>
  always: string[]
}

// Question
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
}

export type QuestionAnswer = string[]

// Todo
export type Todo = {
  content: string
  status: string
  priority: string
}

// SSE Event types
export type SSEEvent =
  | { type: "message.updated"; properties: { info: Message } }
  | { type: "message.removed"; properties: { sessionID: string; messageID: string } }
  | { type: "message.part.updated"; properties: { part: Part } }
  | { type: "message.part.delta"; properties: { messageID: string; partID: string; field: string; delta: string } }
  | { type: "message.part.removed"; properties: { sessionID: string; messageID: string; partID: string } }
  | { type: "permission.asked"; properties: PermissionRequest }
  | { type: "permission.replied"; properties: { sessionID: string; requestID: string } }
  | { type: "question.asked"; properties: QuestionRequest }
  | { type: "question.replied"; properties: { sessionID: string; requestID: string } }
  | { type: "question.rejected"; properties: { sessionID: string; requestID: string } }
  | { type: "todo.updated"; properties: { sessionID: string; todos: Todo[] } }
  | { type: "session.status"; properties: { sessionID: string; status: SessionStatus } }
  | { type: "session.idle"; properties: { sessionID: string } }
  | { type: "session.created"; properties: { info: Session } }
  | { type: "session.updated"; properties: { info: Session } }

// Reducer state
export type AgentState = {
  sessionId: string | null
  messages: Record<string, Message>
  messageOrder: string[]
  parts: Record<string, Part[]>
  status: SessionStatus
  permission: PermissionRequest | null
  question: QuestionRequest | null
  todos: Todo[]
  error: string | null
}
