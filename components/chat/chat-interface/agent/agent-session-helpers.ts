import type { AgentState, Message, Part } from "./types"

let localIdTimestamp = 0
let localIdCounter = 0

export function createLocalAscendingId(prefix: "msg" | "prt"): string {
  const now = Date.now()
  if (now !== localIdTimestamp) {
    localIdTimestamp = now
    localIdCounter = 0
  }
  localIdCounter += 1

  const monotonic = (BigInt(now) * 0x1000n + BigInt(localIdCounter))
    .toString(16)
    .padStart(12, "0")
    .slice(-12)
  const random = Math.random().toString(36).slice(2, 16).padEnd(14, "0").slice(0, 14)
  return `${prefix}_${monotonic}${random}`
}

export function normalizeSessionStatusValue(input: unknown): AgentState["status"] | null {
  if (!input) return null

  if (typeof input === "object" && input !== null) {
    const record = input as Record<string, unknown>
    if (record.status && typeof record.status === "object") {
      return normalizeSessionStatusValue(record.status)
    }
    if (record.state && typeof record.state === "object") {
      return normalizeSessionStatusValue(record.state)
    }
  }

  const obj =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : null
  const raw =
    (typeof input === "string" && input) ||
    (typeof obj?.type === "string" && obj.type) ||
    (typeof obj?.status === "string" && obj.status) ||
    ""
  const value = raw.trim().toLowerCase()

  if (value === "retry" || value === "retrying") {
    return {
      type: "retry",
      attempt: Number(obj?.attempt || 0),
      message: String(obj?.message || ""),
      next: Number(obj?.next || 0),
    }
  }

  if (
    value === "busy" ||
    value === "running" ||
    value === "processing" ||
    value === "in_progress" ||
    value === "in-progress" ||
    value === "pending" ||
    value === "queued" ||
    value === "waiting"
  ) {
    return { type: "busy" }
  }

  if (
    value === "idle" ||
    value === "done" ||
    value === "completed" ||
    value === "complete" ||
    value === "finished" ||
    value === "stopped"
  ) {
    return { type: "idle" }
  }

  if (obj && typeof obj.attempt !== "undefined" && typeof obj.next !== "undefined") {
    return {
      type: "retry",
      attempt: Number(obj.attempt || 0),
      message: String(obj.message || ""),
      next: Number(obj.next || 0),
    }
  }

  return null
}

export function pickVisibleUserText(parts: Part[]): string {
  const textPart = parts.find(
    (part): part is Extract<Part, { type: "text" }> =>
      part.type === "text" &&
      typeof part.text === "string" &&
      part.synthetic !== true,
  )
  return (textPart?.text || "").trim()
}

export function shouldPreserveLocalMessage(existing: Message, incoming: Message) {
  if (existing.role !== incoming.role) return false

  if (existing.role === "assistant" && incoming.role === "assistant") {
    if (existing.error && !incoming.error) return true
    if (existing.time?.completed && !incoming.time?.completed) return true

    const existingFinish = existing.finish || ""
    const incomingFinish = incoming.finish || ""
    if (
      existingFinish &&
      !["tool-calls", "unknown"].includes(existingFinish) &&
      existingFinish !== incomingFinish
    ) {
      return true
    }
  }

  return false
}

export function shouldPreserveLocalPart(existing: Part, incoming: Part, isSessionBusy: boolean) {
  if (existing.type !== incoming.type) return false

  if ((existing.type === "text" || existing.type === "reasoning") && "text" in incoming) {
    const existingText = existing.text || ""
    const incomingText = incoming.text || ""
    if (isSessionBusy && existingText.length > incomingText.length && existingText.startsWith(incomingText)) {
      return true
    }
  }

  if (existing.type === "tool" && incoming.type === "tool" && existing.tool === incoming.tool) {
    const rank = {
      pending: 0,
      running: 1,
      completed: 2,
      error: 2,
    } as const
    return rank[existing.state.status] > rank[incoming.state.status]
  }

  return false
}
