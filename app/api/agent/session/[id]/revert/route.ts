import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { opencodeFetchWithFallback, readResponsePayload, resolveBaseUrlFromRequest } from "@/lib/opencode/server"
import { syncAgentSessionFromPayload } from "@/lib/agent/session-sync"

type RevertPayload = {
  messageID?: string
  partID?: string
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id as string

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
  }

  const baseUrl = resolveBaseUrlFromRequest(req)

  let body: RevertPayload = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  if (!body?.messageID && !body?.partID) {
    return NextResponse.json(
      { error: "messageID or partID is required" },
      { status: 400 }
    )
  }

  try {
    const { response } = await opencodeFetchWithFallback(
      [`/session/${id}/revert`, `/sessions/${id}/revert`],
      {
        method: "POST",
        body: {
          messageID: body?.messageID,
          partID: body?.partID,
        },
        baseUrl,
      }
    )
    const payload = await readResponsePayload(response)

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to revert session", details: payload },
        { status: response.status }
      )
    }

    try {
      const messagesResult = await opencodeFetchWithFallback([
        `/session/${id}/message`,
        `/session/${id}/messages`,
      ], { baseUrl })
      const messagesPayload = await readResponsePayload(messagesResult.response)
      if (messagesResult.response.ok) {
        await syncAgentSessionFromPayload({
          userId,
          opencodeSessionId: id,
          payload: messagesPayload,
        })
      }
    } catch {
      // non-blocking sync
    }

    return NextResponse.json(payload?.data ?? payload ?? {})
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to reach OpenCode", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}
