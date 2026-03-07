export type ProviderInfo = {
  all: Array<{
    id: string
    source: string
    name: string
    models: Record<string, { id: string; name: string; status: string }>
  }>
  default: Record<string, string>
  connected: string[]
}

export type VisibleProvider = ProviderInfo["all"][number] & {
  visibleModels: Array<[string, { id: string; name: string; status: string }]>
}

export type AddedProvidersPayload = {
  providers?: Array<{
    id: string
    name?: string
    models?: Array<{ id: string; name?: string }>
  }>
}

export type ContainerInfo = {
  version?: string
  healthy?: boolean
  status?: string
  config?: {
    containerName: string
    imageName: string
    hostPort: number
    portRange?: {
      start: number
      end: number
    }
    workspaceVolume: string | null
    homeVolume?: string | null
    workdir: string
    homeDir?: string
    bindAddress?: string
    networkName?: string
    workspacePersistence?: boolean
    idleTimeoutMinutes?: number
    readOnlyRootfs?: boolean
    limits: {
      memory: string
      cpus: string
      pids: number
    }
  }
}

export type FileNode = {
  name: string
  path: string
  absolute: string
  type: "file" | "directory"
  ignored: boolean
}

export type FileContent = {
  type: "text" | "binary"
  content: string
  diff?: string
  encoding?: "base64"
  mimeType?: string
}

export type FileStatus = {
  path: string
  added: number
  removed: number
  status: "added" | "deleted" | "modified"
}

export type SessionMessage = {
  info: {
    id: string
    role: "user" | "assistant"
    time?: { created?: number }
  }
}

export type FileDiff = {
  file: string
  before: string
  after: string
  additions: number
  deletions: number
  status?: "added" | "deleted" | "modified"
}

export type DockPanel = "explorer" | "changes" | "settings" | "providers" | "logs"

export type DiffRow =
  | { kind: "context"; leftNumber: number | null; rightNumber: number | null; text: string }
  | { kind: "removed"; leftNumber: number | null; rightNumber: null; text: string }
  | { kind: "added"; leftNumber: null; rightNumber: number | null; text: string }
