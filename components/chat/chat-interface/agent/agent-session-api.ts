import type { Message, Part, Session } from "./types"

const API_BASE = "/api/agent/opencode"

export type AgentHealthPayload = {
  healthy?: boolean
  status?: string
}

export type AgentApiError = Error & {
  status?: number
  suppressUserError?: boolean
  health?: AgentHealthPayload | null
}

export async function api<T = unknown>(
  path: string,
  opts?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...opts?.headers,
    },
  })
  if (!res.ok) {
    const raw = await res.text()
    const isUnreachable =
      res.status === 502 &&
      (raw.includes("opencode server unreachable") ||
        raw.includes("\"error\":\"opencode server unreachable\""))

    if (isUnreachable) {
      let health: AgentHealthPayload | null = null
      try {
        const healthRes = await fetch("/api/agent", { cache: "no-store" })
        if (healthRes.ok) {
          health = (await healthRes.json()) as AgentHealthPayload
        }
      } catch {
        // ignore health check failure
      }

      const err = new Error("opencode server unreachable") as AgentApiError
      err.status = res.status
      err.suppressUserError = true
      err.health = health
      throw err
    }

    throw new Error(`API error ${res.status}: ${raw}`)
  }
  const text = await res.text()
  if (!text) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    const preview = text.trim().slice(0, 80)
    throw new Error(`Invalid JSON response from ${path}: ${preview}`)
  }
}

export function pickSessionId(payload: any): string | null {
  const candidates = [
    payload?.id,
    payload?.data?.id,
    payload?.sessionID,
    payload?.data?.sessionID,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate
    }
  }

  return null
}

export function normalizeSessionList(payload: any): Session[] {
  if (Array.isArray(payload)) return payload as Session[]
  if (Array.isArray(payload?.sessions)) return payload.sessions as Session[]
  if (Array.isArray(payload?.data)) return payload.data as Session[]
  return []
}

export function normalizeSessionMessages(payload: any): Array<{ message: Message; parts: Part[] }> {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.messages)
      ? payload.messages
      : Array.isArray(payload?.data)
        ? payload.data
        : []

  return items
    .map((item: any) => {
      const message = item?.info ?? item?.message ?? null
      const parts = Array.isArray(item?.parts) ? item.parts : []
      return message ? { message, parts } : null
    })
    .filter(Boolean) as Array<{ message: Message; parts: Part[] }>
}

export function isSamePayload(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

export function isSuppressedApiError(err: unknown): err is AgentApiError {
  return Boolean((err as AgentApiError | undefined)?.suppressUserError)
}
