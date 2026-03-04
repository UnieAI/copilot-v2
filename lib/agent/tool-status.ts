import type { ToolStatus } from "./types"

export function normalizeToolStatus(input: unknown): ToolStatus {
  const raw = String(input ?? "").trim().toLowerCase()

  if (!raw || raw === "pending" || raw === "queued" || raw === "waiting") return "pending"

  if (
    raw === "running" ||
    raw === "in_progress" ||
    raw === "in-progress" ||
    raw === "executing" ||
    raw === "processing" ||
    raw === "working" ||
    raw === "busy" ||
    raw === "retry" ||
    raw === "retrying"
  ) {
    return "running"
  }

  if (
    raw === "completed" ||
    raw === "complete" ||
    raw === "done" ||
    raw === "success" ||
    raw === "succeeded" ||
    raw === "finished"
  ) {
    return "completed"
  }

  if (
    raw === "error" ||
    raw === "failed" ||
    raw === "failure" ||
    raw === "cancelled" ||
    raw === "canceled" ||
    raw === "aborted" ||
    raw === "rejected" ||
    raw === "timeout" ||
    raw === "timed_out"
  ) {
    return "error"
  }

  if (raw.includes("error") || raw.includes("fail") || raw.includes("cancel") || raw.includes("abort")) {
    return "error"
  }
  if (raw.includes("complete") || raw.includes("success") || raw.includes("finish")) {
    return "completed"
  }
  if (raw.includes("run") || raw.includes("progress") || raw.includes("work") || raw.includes("process")) {
    return "running"
  }

  // Fallback to running so unknown in-flight states still look active.
  return "running"
}
