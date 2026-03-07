import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const DEFAULT_HOST = process.env.OPENCODE_HOST || "127.0.0.1"
const DEFAULT_PORT = process.env.OPENCODE_PORT || "4096"
const DEFAULT_WORKDIR = process.env.OPENCODE_CONTAINER_WORKDIR || "/workspace"
const OPENCODE_BASE = (process.env.OPENCODE_BASE_URL || `http://${DEFAULT_HOST}:${DEFAULT_PORT}`).replace(/\/+$/, "")

function buildAuthorizationHeader() {
  const username = process.env.OPENCODE_SANDBOX_USERNAME
  const password = process.env.OPENCODE_SANDBOX_PASSWORD
  if (!username || typeof password !== "string") return null
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
}

async function proxyRequest(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const targetPath = "/" + path.join("/")
  const url = new URL(targetPath, OPENCODE_BASE)
  url.search = req.nextUrl.search

  const isSSE =
    req.headers.get("accept")?.includes("text/event-stream") ||
    targetPath.includes("/event")

  const headers = new Headers()
  for (const [key, value] of req.headers.entries()) {
    if (
      key === "host" ||
      key === "connection" ||
      key === "transfer-encoding"
    )
      continue
    headers.set(key, value)
  }

  // Scope opencode requests to this workspace so sessions appear consistently.
  headers.set("x-opencode-directory", process.env.OPENCODE_WORKSPACE_DIR || DEFAULT_WORKDIR)
  if (!headers.has("authorization")) {
    const authHeader = buildAuthorizationHeader()
    if (authHeader) headers.set("authorization", authHeader)
  }

  let body: BodyInit | null = null
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text()
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json")
    }
  }

  let upstream: Response
  try {
    upstream = await fetch(url.toString(), {
      method: req.method,
      headers,
      body,
      signal: isSSE ? undefined : AbortSignal.timeout(30_000),
    })
  } catch {
    return NextResponse.json(
      { error: "opencode server unreachable" },
      { status: 502 },
    )
  }

  if (isSSE && upstream.body) {
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            controller.enqueue(value)
          }
        } catch {
          // connection closed
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  }

  const responseHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    if (key !== "transfer-encoding") {
      responseHeaders.set(key, value)
    }
  })

  const noBodyStatus =
    req.method === "HEAD" ||
    upstream.status === 204 ||
    upstream.status === 205 ||
    upstream.status === 304

  if (noBodyStatus) {
    responseHeaders.delete("content-length")
    return new Response(null, {
      status: upstream.status,
      headers: responseHeaders,
    })
  }

  const responseBody = await upstream.arrayBuffer()
  return new Response(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(req, ctx)
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(req, ctx)
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(req, ctx)
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(req, ctx)
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(req, ctx)
}
