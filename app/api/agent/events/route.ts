import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { opencodeFetchWithFallback, readResponsePayload, resolveBaseUrlFromRequest } from "@/lib/opencode/server"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const baseUrl = resolveBaseUrlFromRequest(req)

  try {
    const { response } = await opencodeFetchWithFallback(["/event", "/global/event"], {
      headers: {
        Accept: "text/event-stream",
      },
      baseUrl,
    })

    if (!response.ok || !response.body) {
      const payload = await readResponsePayload(response)
      return NextResponse.json(
        { error: "Failed to subscribe OpenCode events", details: payload },
        { status: response.status || 502 }
      )
    }

    const headers = new Headers()
    headers.set("Content-Type", "text/event-stream; charset=utf-8")
    headers.set("Cache-Control", "no-cache, no-transform")
    headers.set("Connection", "keep-alive")
    headers.set("X-Accel-Buffering", "no")

    return new Response(response.body, {
      status: 200,
      headers,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to reach OpenCode", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}
