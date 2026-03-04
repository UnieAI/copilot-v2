import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { opencodeFetchWithFallback, readResponsePayload, resolveBaseUrlFromRequest } from "@/lib/opencode/server"
import { db } from "@/lib/db"
import { chatSessions } from "@/lib/db/schema"
import { and, eq, or } from "drizzle-orm"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
  }

  const baseUrl = resolveBaseUrlFromRequest(req)

  try {
    const { response } = await opencodeFetchWithFallback([`/session/${id}`, `/sessions/${id}`], { baseUrl })
    const payload = await readResponsePayload(response)

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch session", details: payload },
        { status: response.status }
      )
    }

    return NextResponse.json(payload?.data ?? payload ?? {})
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to reach OpenCode", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}

export async function DELETE(
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
    const isUuidId = UUID_RE.test(id)
    const localMatcher = isUuidId
      ? or(eq(chatSessions.id, id), eq(chatSessions.externalSessionId, id))
      : eq(chatSessions.externalSessionId, id)

    const localSession = await db.query.chatSessions.findFirst({
      where: and(
        eq(chatSessions.userId, userId),
        eq(chatSessions.mode, "agent"),
        localMatcher
      ),
      columns: { id: true, externalSessionId: true },
    })

    const opencodeSessionId = localSession?.externalSessionId || id

    const { response } = await opencodeFetchWithFallback(
      [`/session/${opencodeSessionId}`, `/sessions/${opencodeSessionId}`],
      { method: "DELETE", baseUrl }
    )
    const payload = await readResponsePayload(response)

    // Treat 404 as already deleted remotely, and continue local cleanup.
    if (!response.ok && response.status !== 404) {
      return NextResponse.json(
        { error: "Failed to delete session", details: payload },
        { status: response.status }
      )
    }

    const deleteMatchers = [
      eq(chatSessions.externalSessionId, id),
      eq(chatSessions.externalSessionId, opencodeSessionId),
    ]
    if (isUuidId) {
      deleteMatchers.push(eq(chatSessions.id, id))
    }
    const deleteMatcher =
      deleteMatchers.length === 1 ? deleteMatchers[0] : or(...deleteMatchers)

    await db.delete(chatSessions).where(
      and(
        eq(chatSessions.userId, userId),
        eq(chatSessions.mode, "agent"),
        deleteMatcher
      )
    )

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to reach OpenCode", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}
