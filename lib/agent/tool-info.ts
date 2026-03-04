import type { AgentToolPart } from "./types"

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value === null) return "null"
  if (typeof value === "undefined") return "undefined"
  try { return JSON.stringify(value) } catch { return String(value) }
}

function extractSessionIdFromOutput(output: string): string {
  if (!output) return ""
  const m1 = output.match(/task_id:\s*([A-Za-z0-9_-]+)/i)
  if (m1?.[1]) return m1[1]
  const m2 = output.match(/["']task_id["']\s*:\s*["']([A-Za-z0-9_-]+)["']/i)
  if (m2?.[1]) return m2[1]
  const m3 = output.match(/session_id:\s*([A-Za-z0-9_-]+)/i)
  if (m3?.[1]) return m3[1]
  const m4 = output.match(/["']session_id["']\s*:\s*["']([A-Za-z0-9_-]+)["']/i)
  if (m4?.[1]) return m4[1]
  const m5 = output.match(/sessionId:\s*([A-Za-z0-9_-]+)/i)
  if (m5?.[1]) return m5[1]
  const m6 = output.match(/["']sessionId["']\s*:\s*["']([A-Za-z0-9_-]+)["']/i)
  if (m6?.[1]) return m6[1]
  return ""
}

export type ToolIcon = "terminal" | "eye" | "file-code" | "search" | "git-branch" | "wrench" | "file-text" | "list"

export type ToolInfo = {
  icon: ToolIcon
  title: string
  subtitle: string
  inputLines: string[]
  input: Record<string, unknown>
  output: string
  error: string
  childSessionId?: string
}

/** Context tools that can be grouped together */
const CONTEXT_TOOLS = new Set(["read", "glob", "grep", "list", "webfetch", "websearch"])
export function isContextTool(toolName: string): boolean {
  return CONTEXT_TOOLS.has(toolName.toLowerCase())
}

export function getToolIcon(toolName: string): ToolIcon {
  switch (toolName.toLowerCase()) {
    case "bash": return "terminal"
    case "read": case "webfetch": case "websearch": return "eye"
    case "edit": case "write": case "notebookedit": return "file-code"
    case "glob": case "grep": return "search"
    case "task": case "agent": return "git-branch"
    case "list": case "todowrite": case "todoread": return "list"
    default: return "wrench"
  }
}

export function getToolInfo(part: AgentToolPart): ToolInfo {
  const tool = (part.tool || "tool").toLowerCase()
  const input = toRecord(part.state?.input) || {}
  const stateMeta = toRecord(part.state?.metadata) || {}
  const partMeta = toRecord(part.metadata) || {}
  const stateTitle = typeof part.state?.title === "string" ? part.state.title : ""
  const output =
    (typeof part.state?.output === "string" && part.state.output) ||
    (typeof part.state?.raw === "string" && part.state.raw) ||
    ""
  const error = typeof part.state?.error === "string" ? part.state.error : ""

  const subtitle =
    stateTitle ||
    (typeof input.description === "string" ? input.description : "") ||
    (typeof input.filePath === "string" ? input.filePath : "") ||
    (typeof input.path === "string" ? input.path : "") ||
    (typeof input.url === "string" ? input.url : "")

  let title: string
  if (tool === "task" || tool === "agent") {
    const sub = typeof input.subagent_type === "string" && input.subagent_type ? input.subagent_type : "task"
    title = `Agent · ${sub}`
  } else if (tool === "bash") {
    const cmd = String(input.command || input.cmd || "")
    const short = cmd.split("\n")[0]?.slice(0, 56) || ""
    title = `Shell${short ? ` · ${short}${cmd.length > 56 ? "..." : ""}` : ""}`
  } else if (tool === "edit" || tool === "write") {
    const fp = String(input.filePath || input.file || "")
    const base = fp ? fp.split("/").pop() || fp : ""
    title = `${tool === "edit" ? "Edit" : "Write"}${base ? ` · ${base}` : ""}`
  } else if (tool === "read") {
    const fp = String(input.filePath || input.file || "")
    const base = fp ? fp.split("/").pop() || fp : ""
    title = `Read${base ? ` · ${base}` : ""}`
  } else if (tool === "glob") {
    const pat = String(input.pattern || "")
    title = `Glob${pat ? ` · ${pat}` : ""}`
  } else if (tool === "grep") {
    const pat = String(input.pattern || "")
    title = `Grep${pat ? ` · "${pat}"` : ""}`
  } else if (tool === "todowrite") {
    title = "Todo · Write"
  } else if (tool === "todoread") {
    title = "Todo · Read"
  } else {
    title = tool
  }

  const childSessionId =
    (typeof stateMeta.sessionId === "string" && stateMeta.sessionId) ||
    (typeof stateMeta.sessionID === "string" && stateMeta.sessionID) ||
    (typeof stateMeta.session_id === "string" && stateMeta.session_id) ||
    (typeof stateMeta.taskId === "string" && stateMeta.taskId) ||
    (typeof stateMeta.taskID === "string" && stateMeta.taskID) ||
    (typeof stateMeta.task_id === "string" && stateMeta.task_id) ||
    (typeof partMeta.sessionId === "string" && partMeta.sessionId) ||
    (typeof partMeta.sessionID === "string" && partMeta.sessionID) ||
    (typeof partMeta.session_id === "string" && partMeta.session_id) ||
    (typeof partMeta.taskId === "string" && partMeta.taskId) ||
    (typeof partMeta.taskID === "string" && partMeta.taskID) ||
    (typeof partMeta.task_id === "string" && partMeta.task_id) ||
    (typeof input.sessionId === "string" && input.sessionId) ||
    (typeof input.sessionID === "string" && input.sessionID) ||
    (typeof input.session_id === "string" && input.session_id) ||
    (typeof input.taskId === "string" && input.taskId) ||
    (typeof input.taskID === "string" && input.taskID) ||
    (typeof input.task_id === "string" && input.task_id) ||
    extractSessionIdFromOutput(output) ||
    ""

  const inputLines = Object.entries(input)
    .filter(([key]) => key !== "description")
    .map(([key, value]) => {
      const raw = stringifyValue(value)
      const text = raw.length > 220 ? `${raw.slice(0, 220)}...` : raw
      return `${key}: ${text}`
    })

  return {
    icon: getToolIcon(tool),
    title,
    subtitle,
    inputLines,
    input,
    output,
    error,
    childSessionId: childSessionId || undefined,
  }
}
