export type AgentRuntimeModel = {
  providerID: string
  modelID: string
}

export type AgentRuntimeConfig = {
  agent?: string
  model?: AgentRuntimeModel
  variant?: string
}
