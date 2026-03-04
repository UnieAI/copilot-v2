import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { opencodeFetchWithFallback, readResponsePayload, resolveBaseUrlFromRequest } from "@/lib/opencode/server"
import { ensureAgentSessionRecord } from "@/lib/agent/session-sync"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const baseUrl = resolveBaseUrlFromRequest(req)

  try {
    const { response } = await opencodeFetchWithFallback(["/session", "/sessions"], { baseUrl })
    const payload = await readResponsePayload(response)

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch sessions", details: payload },
        { status: response.status }
      )
    }

    return NextResponse.json(payload?.data ?? payload ?? [])
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to reach OpenCode", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id as string

  const baseUrl = resolveBaseUrlFromRequest(req)

  let body: { title?: string; parentID?: string } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  try {
    let result = await opencodeFetchWithFallback(["/session", "/session/create"], {
      method: "POST",
      body: {
        title: body?.title,
        parentID: body?.parentID,
      },
      baseUrl,
    })
    let payload = await readResponsePayload(result.response)

    // Some OpenCode versions only accept {} for session creation.
    if (!result.response.ok && (body?.title || body?.parentID)) {
      result = await opencodeFetchWithFallback(["/session", "/session/create"], {
        method: "POST",
        body: {},
        baseUrl,
      })
      payload = await readResponsePayload(result.response)
    }

    if (!result.response.ok) {
      return NextResponse.json(
        { error: "Failed to create session", details: payload },
        { status: result.response.status }
      )
    }

    const sessionId = String(payload?.data?.id || payload?.id || payload?.sessionID || "")
    if (sessionId) {
      await ensureAgentSessionRecord({
        userId,
        opencodeSessionId: sessionId,
        title: body?.title,
      })
    }

    return NextResponse.json(payload?.data ?? payload ?? {})
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to reach OpenCode", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}
