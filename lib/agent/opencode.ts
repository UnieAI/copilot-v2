import "server-only"

type Primitive = string | number | boolean
type QueryValue = Primitive | null | undefined

export type OpencodeRequestOptions = {
  method?: string
  headers?: HeadersInit
  body?: unknown
  query?: Record<string, QueryValue>
  signal?: AbortSignal
}

const DEFAULT_HOST = process.env.OPENCODE_HOST || "127.0.0.1"
const DEFAULT_PORT = process.env.OPENCODE_PORT || "4096"
const DEFAULT_WORKDIR = process.env.OPENCODE_CONTAINER_WORKDIR || "/workspace"

export function getOpencodeBaseUrl() {
  return (process.env.OPENCODE_BASE_URL || `http://${DEFAULT_HOST}:${DEFAULT_PORT}`).replace(/\/+$/, "")
}

function getWorkspacePath() {
  return process.env.OPENCODE_WORKSPACE_DIR || DEFAULT_WORKDIR
}

export function buildOpencodeHeaders(extraHeaders?: HeadersInit, includeJsonContentType = true) {
  const headers = new Headers(extraHeaders)
  headers.set("x-opencode-directory", getWorkspacePath())

  if (includeJsonContentType) {
    headers.set("Content-Type", "application/json")
  }

  const username = process.env.OPENCODE_SANDBOX_USERNAME
  const password = process.env.OPENCODE_SANDBOX_PASSWORD
  if (username && typeof password === "string") {
    const token = Buffer.from(`${username}:${password}`).toString("base64")
    headers.set("Authorization", `Basic ${token}`)
  }

  return headers
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const target = new URL(path.startsWith("/") ? path : `/${path}`, `${getOpencodeBaseUrl()}/`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === null || typeof v === "undefined") continue
      target.searchParams.set(k, String(v))
    }
  }
  return target.toString()
}

export async function opencodeFetch(path: string, options: OpencodeRequestOptions = {}) {
  const { method = "GET", headers, body, query, signal } = options
  return fetch(buildUrl(path, query), {
    method,
    headers: buildOpencodeHeaders(headers, typeof body !== "undefined"),
    body: typeof body === "undefined" ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal,
  })
}

export async function readResponsePayload(res: Response) {
  const text = await res.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}
