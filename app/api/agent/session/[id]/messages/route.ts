import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { opencodeFetchWithFallback, readResponsePayload, resolveBaseUrlFromRequest } from "@/lib/opencode/server"
import { syncAgentSessionFromPayload } from "@/lib/agent/session-sync"

export async function GET(
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

  try {
    const { response } = await opencodeFetchWithFallback([
      `/session/${id}/message`,
      `/session/${id}/messages`,
    ], { baseUrl })
    const payload = await readResponsePayload(response)

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch session messages", details: payload },
        { status: response.status }
      )
    }

    try {
      await syncAgentSessionFromPayload({
        userId,
        opencodeSessionId: id,
        payload,
      })
    } catch (syncError) {
      console.warn("[agent-sync] failed to persist messages", syncError)
    }

    return NextResponse.json(payload?.data ?? payload ?? [])
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to reach OpenCode", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}
