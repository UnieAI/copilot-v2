import type { AgentRuntimeConfig } from "./agent-session-config"

export type OptimisticUserMessage = {
  sessionId: string
  text: string
  createdAt: number
}

export type PendingPrompt = {
  id: string
  sessionId: string
  text: string
  createdAt: number
  runtimeConfig?: AgentRuntimeConfig
}
