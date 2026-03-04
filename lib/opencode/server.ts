import "server-only"

type Primitive = string | number | boolean
type QueryValue = Primitive | null | undefined

type RequestOptions = {
  method?: string
  headers?: HeadersInit
  body?: unknown
  query?: Record<string, QueryValue>
  signal?: AbortSignal
  baseUrl?: string
}

const DEFAULT_HOST = process.env.OPENCODE_HOST || "127.0.0.1"
const DEFAULT_PORT = process.env.OPENCODE_PORT || "4096"
const DEFAULT_BASE_URL = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`

export function getOpencodeBaseUrl() {
  return (process.env.OPENCODE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "")
}

function getWorkspacePath() {
  return process.env.OPENCODE_WORKSPACE_DIR || process.cwd()
}

export function buildOpencodeHeaders(
  extraHeaders?: HeadersInit,
  options?: { includeJsonContentType?: boolean }
) {
  const headers = new Headers(extraHeaders)
  if (options?.includeJsonContentType !== false) {
    headers.set("Content-Type", "application/json")
  }
  headers.set("x-opencode-directory", getWorkspacePath())

  const username = process.env.OPENCODE_SANDBOX_USERNAME
  const password = process.env.OPENCODE_SANDBOX_PASSWORD
  if (username && typeof password === "string") {
    const token = Buffer.from(`${username}:${password}`).toString("base64")
    headers.set("Authorization", `Basic ${token}`)
  }

  return headers
}

export function buildInstanceBaseUrl(port: number | string, hostname?: string) {
  const normalizedHost =
    !hostname || hostname === "0.0.0.0" || hostname === "::"
      ? "127.0.0.1"
      : hostname
  const host = normalizedHost
  return `http://${host}:${port}`
}

export function resolveBaseUrlFromRequest(req: Request): string | undefined {
  try {
    const url = new URL(req.url)
    const port = url.searchParams.get("port")
    if (!port) return undefined
    const hostname = url.searchParams.get("hostname") || undefined
    return buildInstanceBaseUrl(port, hostname)
  } catch {
    return undefined
  }
}

function buildUrl(path: string, query?: Record<string, QueryValue>, baseUrl?: string) {
  const base = baseUrl || getOpencodeBaseUrl()
  const target = new URL(path.startsWith("/") ? path : `/${path}`, `${base}/`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === null || typeof v === "undefined") continue
      target.searchParams.set(k, String(v))
    }
  }
  return target.toString()
}

export async function opencodeFetch(path: string, options: RequestOptions = {}) {
  const { method = "GET", headers, body, query, signal, baseUrl } = options
  return fetch(buildUrl(path, query, baseUrl), {
    method,
    headers: buildOpencodeHeaders(headers, {
      includeJsonContentType: typeof body !== "undefined",
    }),
    body: typeof body === "undefined" ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal,
  })
}

export async function opencodeFetchWithFallback(paths: string[], options: RequestOptions = {}) {
  let lastResponse: Response | null = null
  let lastError: unknown = null

  const attemptedBaseUrls = new Set<string | undefined>()
  const defaultBaseUrl = getOpencodeBaseUrl()

  const candidateBaseUrls: Array<string | undefined> = []
  if (options.baseUrl) {
    candidateBaseUrls.push(options.baseUrl)
  }
  if (!options.baseUrl || options.baseUrl !== defaultBaseUrl) {
    candidateBaseUrls.push(undefined)
  }

  for (const baseUrlCandidate of candidateBaseUrls) {
    const normalizedKey = baseUrlCandidate || defaultBaseUrl
    if (attemptedBaseUrls.has(normalizedKey)) continue
    attemptedBaseUrls.add(normalizedKey)

    for (const path of paths) {
      try {
        const res = await opencodeFetch(path, {
          ...options,
          baseUrl: baseUrlCandidate,
        })
        if (res.ok) {
          return { response: res, path }
        }
        lastResponse = res
        if (res.status !== 404) {
          return { response: res, path }
        }
      } catch (error) {
        lastError = error
      }
    }
  }

  if (!lastResponse) {
    if (lastError) {
      throw lastError
    }
    throw new Error("No OpenCode endpoint candidates were provided")
  }

  return { response: lastResponse, path: paths[paths.length - 1] }
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
