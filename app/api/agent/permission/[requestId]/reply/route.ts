import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { opencodeFetchWithFallback, readResponsePayload, resolveBaseUrlFromRequest } from "@/lib/opencode/server"

type PermissionReplyBody = {
  reply?: "once" | "always" | "reject"
  message?: string
  sessionID?: string
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { requestId } = await params
  if (!requestId) {
    return NextResponse.json({ error: "Request ID is required" }, { status: 400 })
  }

  const baseUrl = resolveBaseUrlFromRequest(req)

  let body: PermissionReplyBody = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const reply = body.reply
  if (reply !== "once" && reply !== "always" && reply !== "reject") {
    return NextResponse.json({ error: "Invalid reply value" }, { status: 400 })
  }

  try {
    let result = await opencodeFetchWithFallback([`/permission/${requestId}/reply`], {
      method: "POST",
      body: { reply, message: body.message || undefined },
      baseUrl,
    })
    let payload = await readResponsePayload(result.response)

    if (!result.response.ok && result.response.status === 404 && body.sessionID) {
      result = await opencodeFetchWithFallback([`/session/${body.sessionID}/permissions/${requestId}`], {
        method: "POST",
        body: { response: reply },
        baseUrl,
      })
      payload = await readResponsePayload(result.response)
    }

    if (!result.response.ok) {
      return NextResponse.json(
        { error: "Failed to reply permission", details: payload },
        { status: result.response.status }
      )
    }

    return NextResponse.json(payload?.data ?? payload ?? true)
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to reach OpenCode", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}
