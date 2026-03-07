"use client"

import { BasicTool } from "./basic-tool"
import { getToolInfo, type ToolCardProps } from "./index"

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function extractSessionIdFromTaskOutput(output: string): string {
  if (!output) return ""
  const direct = output.match(/task_id:\s*([A-Za-z0-9_-]+)/i)
  if (direct?.[1]) return direct[1]
  const quoted = output.match(/["']task_id["']\s*:\s*["']([A-Za-z0-9_-]+)["']/i)
  if (quoted?.[1]) return quoted[1]
  const sessionDirect = output.match(/session_id:\s*([A-Za-z0-9_-]+)/i)
  if (sessionDirect?.[1]) return sessionDirect[1]
  const sessionQuoted = output.match(/["']session_id["']\s*:\s*["']([A-Za-z0-9_-]+)["']/i)
  if (sessionQuoted?.[1]) return sessionQuoted[1]
  const camelDirect = output.match(/sessionId:\s*([A-Za-z0-9_-]+)/i)
  if (camelDirect?.[1]) return camelDirect[1]
  const camelQuoted = output.match(/["']sessionId["']\s*:\s*["']([A-Za-z0-9_-]+)["']/i)
  if (camelQuoted?.[1]) return camelQuoted[1]
  return ""
}

function extractSessionIdFromRaw(raw: string): string {
  if (!raw) return ""
  const patterns = [
    /["']task_id["']\s*:\s*["']([A-Za-z0-9_-]+)["']/i,
    /["']session_id["']\s*:\s*["']([A-Za-z0-9_-]+)["']/i,
    /["']sessionId["']\s*:\s*["']([A-Za-z0-9_-]+)["']/i,
    /task_id:\s*([A-Za-z0-9_-]+)/i,
    /session_id:\s*([A-Za-z0-9_-]+)/i,
    /sessionId:\s*([A-Za-z0-9_-]+)/i,
  ]
  for (const pattern of patterns) {
    const match = raw.match(pattern)
    if (match?.[1]) return match[1]
  }
  return ""
}

export function TaskTool({ part, defaultOpen, onOpenSubAgent }: ToolCardProps) {
  const info = getToolInfo(part.tool, part.state.input)
  const pending = part.state.status === "pending" || part.state.status === "running"
  const stateTitle = typeof (part.state as any).title === "string"
    ? ((part.state as any).title as string)
    : undefined
  const output =
    part.state.status === "completed"
      ? part.state.output
      : part.state.status === "error"
        ? part.state.error
        : undefined

  const input = asRecord(part.state.input)
  const stateMeta = "metadata" in part.state ? asRecord((part.state as any).metadata) : {}
  const partMeta = asRecord((part as any).metadata)
  const raw =
    "raw" in part.state && typeof (part.state as any).raw === "string"
      ? ((part.state as any).raw as string)
      : ""
  const childSessionId = (
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
    extractSessionIdFromRaw(raw) ||
    extractSessionIdFromTaskOutput(output || "")
  ) as string
  const summary =
    stateTitle ||
    (output?.trim() ? output.trim().split("\n").find(Boolean)?.slice(0, 160) : undefined) ||
    (typeof input.description === "string" ? input.description : undefined) ||
    (pending ? "建立 subagent 中" : undefined)

  return (
    <BasicTool
      icon={info.icon}
      title={info.title}
      subtitle={stateTitle || info.subtitle}
      summary={summary}
      status={part.state.status}
      defaultOpen={defaultOpen || pending}
      lockWhilePending={false}
    >
      {childSessionId && (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => onOpenSubAgent?.(childSessionId)}
            className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-500/20 dark:text-blue-300"
          >
            {pending ? "開啟 Subagent Sidebar（執行中）" : "開啟 Subagent Sidebar"} ({childSessionId.slice(0, 12)})
          </button>
        </div>
      )}
      {pending && !childSessionId && (
        <div className="mb-2 text-xs text-muted-foreground">
          正在建立 subagent session...
        </div>
      )}
      {output && (
        <pre className="text-xs bg-muted/40 rounded-md px-3 py-2 overflow-x-auto max-h-[300px] overflow-y-auto font-mono text-foreground/70">
          <code>{output}</code>
        </pre>
      )}
    </BasicTool>
  )
}
