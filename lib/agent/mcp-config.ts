export type AgentRemoteMcpServerConfig = {
  type: "remote"
  url: string
  enabled?: boolean
  headers?: Record<string, string>
  timeout?: number
  oauth?: false
}

export type AgentRemoteMcpServer = {
  id: string
  config: AgentRemoteMcpServerConfig
}

export type AgentOpencodeConfig = {
  $schema: string
  mcp: Record<string, AgentRemoteMcpServerConfig>
}
