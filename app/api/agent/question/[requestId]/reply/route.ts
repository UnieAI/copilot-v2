import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { opencodeFetchWithFallback, readResponsePayload, resolveBaseUrlFromRequest } from "@/lib/opencode/server"

type QuestionReplyBody = {
  answers?: string[][]
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

  let body: QuestionReplyBody = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  if (!Array.isArray(body.answers)) {
    return NextResponse.json({ error: "answers must be an array" }, { status: 400 })
  }

  try {
    const { response } = await opencodeFetchWithFallback([`/question/${requestId}/reply`], {
      method: "POST",
      body: {
        answers: body.answers,
      },
      baseUrl,
    })
    const payload = await readResponsePayload(response)

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to reply question", details: payload },
        { status: response.status }
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
