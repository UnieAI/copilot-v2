import "server-only"

import { execFile, spawn } from "child_process"
import { promisify } from "util"

type Primitive = string | number | boolean
type QueryValue = Primitive | null | undefined

const execFileAsync = promisify(execFile)
const CURL_STATUS_MARKER = "\n__OPENCODE_STATUS__:"
const CURL_CONTENT_TYPE_MARKER = "\n__OPENCODE_CONTENT_TYPE__:"

export type OpencodeRuntimeTarget = {
  baseUrl: string
  workdir: string
  containerName?: string
  auth?: {
    username: string
    password: string
  }
}

export type OpencodeRequestOptions = {
  method?: string
  headers?: HeadersInit
  body?: unknown
  query?: Record<string, QueryValue>
  signal?: AbortSignal
  runtime?: OpencodeRuntimeTarget
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

export function buildOpencodeHeaders(
  extraHeaders?: HeadersInit,
  includeJsonContentType = true,
  runtime?: OpencodeRuntimeTarget,
) {
  const headers = new Headers(extraHeaders)
  headers.delete("host")
  headers.delete("connection")
  headers.delete("content-length")
  headers.delete("transfer-encoding")
  headers.set("x-opencode-directory", runtime?.workdir || getWorkspacePath())

  if (includeJsonContentType) {
    headers.set("Content-Type", "application/json")
  }

  const username = runtime?.auth?.username || process.env.OPENCODE_SANDBOX_USERNAME
  const password =
    typeof runtime?.auth?.password === "string"
      ? runtime.auth.password
      : process.env.OPENCODE_SANDBOX_PASSWORD
  if (username && typeof password === "string") {
    const token = Buffer.from(`${username}:${password}`).toString("base64")
    headers.set("Authorization", `Basic ${token}`)
  }

  return headers
}

function buildUrl(path: string, query?: Record<string, QueryValue>, runtime?: OpencodeRuntimeTarget) {
  const target = new URL(path.startsWith("/") ? path : `/${path}`, `${runtime?.baseUrl || getOpencodeBaseUrl()}/`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === null || typeof v === "undefined") continue
      target.searchParams.set(k, String(v))
    }
  }
  return target.toString()
}

function parseCurlResponse(stdout: string) {
  const statusIndex = stdout.lastIndexOf(CURL_STATUS_MARKER)
  const contentTypeIndex = stdout.lastIndexOf(CURL_CONTENT_TYPE_MARKER)

  if (statusIndex === -1 || contentTypeIndex === -1 || contentTypeIndex < statusIndex) {
    return new Response(stdout, { status: 200 })
  }

  const body = stdout.slice(0, statusIndex)
  const statusText = stdout
    .slice(statusIndex + CURL_STATUS_MARKER.length, contentTypeIndex)
    .trim()
  const contentType = stdout
    .slice(contentTypeIndex + CURL_CONTENT_TYPE_MARKER.length)
    .trim()

  const status = Number(statusText) || 200
  const headers = new Headers()
  if (contentType) {
    headers.set("content-type", contentType)
  }

  const noBodyStatus = status === 204 || status === 205 || status === 304

  return new Response(noBodyStatus ? null : body, {
    status,
    headers,
  })
}

async function opencodeExecFetch(
  path: string,
  options: OpencodeRequestOptions,
  runtime: OpencodeRuntimeTarget,
) {
  const { method = "GET", headers, body, query } = options
  const url = buildUrl(path, query, runtime)
  const requestHeaders = buildOpencodeHeaders(headers, typeof body !== "undefined", runtime)
  const bodyText =
    typeof body === "undefined"
      ? undefined
      : typeof body === "string"
        ? body
        : JSON.stringify(body)
  const args = [
    "exec",
    "-i",
    runtime.containerName!,
    "curl",
    "-sS",
    "-X",
    method,
    url,
  ]

  requestHeaders.forEach((value, key) => {
    args.push("-H", `${key}: ${value}`)
  })

  if (typeof bodyText === "string") {
    args.push("--data-raw", bodyText)
  }

  args.push("-w", `${CURL_STATUS_MARKER}%{http_code}${CURL_CONTENT_TYPE_MARKER}%{content_type}`)

  try {
    const { stdout } = await execFileAsync("docker", args, {
      maxBuffer: 16 * 1024 * 1024,
    })
    return parseCurlResponse(stdout)
  } catch (error: any) {
    const stdout = String(error?.stdout || "")
    if (stdout) {
      return parseCurlResponse(stdout)
    }
    return new Response(
      JSON.stringify({
        error: "opencode exec transport failed",
        detail: error?.message || "Unknown error",
      }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      },
    )
  }
}

export function createOpencodeEventStream(
  path: string,
  options: OpencodeRequestOptions = {},
  runtime?: OpencodeRuntimeTarget,
) {
  if (!runtime?.containerName) {
    throw new Error("containerName is required for SSE transport")
  }

  const url = buildUrl(path, options.query, runtime)
  const requestHeaders = buildOpencodeHeaders(options.headers, false, runtime)
  const args = [
    "exec",
    "-i",
    runtime.containerName,
    "curl",
    "-sS",
    "-N",
    url,
  ]

  requestHeaders.forEach((value, key) => {
    args.push("-H", `${key}: ${value}`)
  })

  const child = spawn("docker", args, {
    stdio: ["ignore", "pipe", "pipe"],
  })

  return new ReadableStream<Uint8Array>({
    start(controller) {
      child.stdout.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk))
      })

      child.stderr.on("data", () => {
        // Ignore curl stderr noise once the stream is established.
      })

      child.on("error", (error) => {
        controller.error(error)
      })

      child.on("close", () => {
        controller.close()
      })
    },
    cancel() {
      child.kill()
    },
  })
}

export async function opencodeFetch(path: string, options: OpencodeRequestOptions = {}) {
  const { method = "GET", headers, body, query, signal, runtime } = options

  if (runtime?.containerName) {
    return opencodeExecFetch(path, options, runtime)
  }

  return fetch(buildUrl(path, query, runtime), {
    method,
    headers: buildOpencodeHeaders(headers, typeof body !== "undefined", runtime),
    body:
      typeof body === "undefined"
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
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
