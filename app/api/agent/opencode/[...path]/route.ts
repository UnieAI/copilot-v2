import { NextRequest, NextResponse } from "next/server"
import { getUserAgentRuntime, requireAgentUserId } from "@/lib/agent/runtime"
import { createOpencodeEventStream, opencodeFetch } from "@/lib/agent/opencode"
import {
  resolveReadableSandboxLocation,
  sanitizeWorkspaceBody,
  sanitizeWorkspaceQuery,
} from "@/lib/agent/workspace-guard"

export const runtime = "nodejs"

function traceAbortProxyEvent(input: {
  method: string
  targetPath: string
  userId: string
  body: unknown
}) {
  if (input.method !== "POST") return
  if (!input.targetPath.endsWith("/abort")) return

  const sessionId =
    input.targetPath.split("/").filter(Boolean).at(-2) ?? "unknown"

  console.warn("[agent-abort-trace] forwarding abort request", {
    sessionId,
    targetPath: input.targetPath,
    userId: input.userId,
    body:
      input.body && typeof input.body === "object"
        ? input.body
        : undefined,
  })
}

async function proxyRequest(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  let userId: string
  try {
    userId = await requireAgentUserId()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let agentRuntime: Awaited<ReturnType<typeof getUserAgentRuntime>>
  try {
    agentRuntime = await getUserAgentRuntime(userId)
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to resolve agent runtime"
    return NextResponse.json({ error: message }, { status: 500 })
  }
  const { path } = await params
  const targetPath = "/" + path.join("/")
  let query: Record<string, string>
  const readRoots =
    targetPath.startsWith("/file") || targetPath.startsWith("/find/file")
      ? [agentRuntime.workdir, agentRuntime.homeDir, "/tmp"]
      : [agentRuntime.workdir]
  let directoryRoot = agentRuntime.workdir

  try {
    query = sanitizeWorkspaceQuery(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
      agentRuntime.workdir,
      { readRoots },
    )
    const preferredPath =
      req.nextUrl.searchParams.get("path") ||
      req.nextUrl.searchParams.get("directory") ||
      req.nextUrl.searchParams.get("cwd")
    if (preferredPath && readRoots.length > 1) {
      const location = resolveReadableSandboxLocation(preferredPath, readRoots, {
        allowEmpty: true,
      })
      directoryRoot = location.root
      const relativePath = location.relativePath
      if (req.nextUrl.searchParams.has("path")) {
        query.path = relativePath
      } else if (req.nextUrl.searchParams.has("directory")) {
        query.directory = relativePath
      } else if (req.nextUrl.searchParams.has("cwd")) {
        query.cwd = relativePath
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid sandbox path"
    return NextResponse.json({ error: message }, { status: 400 })
  }
  const isSSE =
    req.headers.get("accept")?.includes("text/event-stream") ||
    targetPath.includes("/event")

  if (isSSE) {
    const stream = createOpencodeEventStream(targetPath, {
      headers: req.headers,
      query,
      runtime: agentRuntime,
    }, agentRuntime)

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  }

  let parsedBody: unknown = undefined
  if (req.method !== "GET" && req.method !== "HEAD") {
    const rawBody = await req.text()
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody)
      } catch {
        parsedBody = rawBody
      }
    }
  }
  try {
    parsedBody = sanitizeWorkspaceBody(targetPath, parsedBody, agentRuntime.workdir)
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid sandbox path"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  traceAbortProxyEvent({
    method: req.method,
    targetPath,
    userId,
    body: parsedBody,
  })

  const upstream = await opencodeFetch(targetPath, {
    method: req.method,
    headers: req.headers,
    body: parsedBody,
    query,
    runtime: {
      ...agentRuntime,
      workdir: directoryRoot,
    },
  })

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
