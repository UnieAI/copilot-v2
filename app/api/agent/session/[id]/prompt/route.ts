import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { and, eq, sql } from "drizzle-orm"
import { opencodeFetchWithFallback, readResponsePayload, resolveBaseUrlFromRequest } from "@/lib/opencode/server"
import { ensureAgentSessionRecord, syncAgentSessionFromPayload } from "@/lib/agent/session-sync"
import { getAvailableModelsForUser } from "@/lib/available-models"
import { db } from "@/lib/db"
import { groupModelQuotas, groupUserModelQuotas, groupUserQuotas, tokenUsage } from "@/lib/db/schema"

type ModelPayload = {
  providerID: string
  modelID: string
}

type PromptPayload = {
  text?: string
  agent?: string
  model?: ModelPayload
}

function toCompositeModelValue(model: ModelPayload) {
  return `${String(model.providerID || "").toUpperCase()}-${String(model.modelID || "")}`
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

  let body: PromptPayload = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const text = body?.text?.trim()
  if (!text) {
    return NextResponse.json({ error: "Message text is required" }, { status: 400 })
  }

  const availableModels = await getAvailableModelsForUser(userId)
  if (availableModels.length === 0) {
    return NextResponse.json(
      { error: "No available models. Please configure a provider first." },
      { status: 403 }
    )
  }

  const allowedModelValues = new Set(availableModels.map((item) => item.value))
  let resolvedModel: ModelPayload | undefined
  if (body.model?.providerID && body.model?.modelID) {
    const requested = {
      providerID: String(body.model.providerID).toUpperCase(),
      modelID: String(body.model.modelID),
    }
    const requestedValue = toCompositeModelValue(requested)
    if (!allowedModelValues.has(requestedValue)) {
      return NextResponse.json(
        { error: "Selected model is not allowed for current user." },
        { status: 403 }
      )
    }
    resolvedModel = requested
  } else {
    const fallback = availableModels[0]
    resolvedModel = {
      providerID: fallback.providerPrefix.toUpperCase(),
      modelID: fallback.label,
    }
  }

  const resolvedValue = toCompositeModelValue(resolvedModel)
  const resolvedModelOption = availableModels.find((item) => item.value === resolvedValue)
  if (!resolvedModelOption) {
    return NextResponse.json(
      { error: "Selected model is not allowed for current user." },
      { status: 403 }
    )
  }

  // Align with normal mode group quota checks.
  if (resolvedModelOption.source === "group" && resolvedModelOption.groupId) {
    const groupId = resolvedModelOption.groupId
    const modelName = resolvedModelOption.label

    const [userQuota, modelQuota, groupModelQuota] = await Promise.all([
      db.query.groupUserQuotas.findFirst({
        where: and(eq(groupUserQuotas.groupId, groupId), eq(groupUserQuotas.userId, userId)),
      }),
      db.query.groupUserModelQuotas.findFirst({
        where: and(
          eq(groupUserModelQuotas.groupId, groupId),
          eq(groupUserModelQuotas.userId, userId),
          eq(groupUserModelQuotas.model, modelName)
        ),
      }),
      db.query.groupModelQuotas.findFirst({
        where: and(
          eq(groupModelQuotas.groupId, groupId),
          eq(groupModelQuotas.model, modelName)
        ),
      }),
    ])

    if (userQuota?.limitTokens != null) {
      const [used] = await db
        .select({ total: sql<number>`coalesce(sum(${tokenUsage.totalTokens}),0)` })
        .from(tokenUsage)
        .where(and(eq(tokenUsage.groupId, groupId), eq(tokenUsage.userId, userId)))
      if ((used?.total || 0) >= userQuota.limitTokens) {
        return NextResponse.json(
          { error: "群組使用額度已用完，請聯絡管理員。" },
          { status: 403 }
        )
      }
    }

    if (modelQuota?.limitTokens != null) {
      const [usedModel] = await db
        .select({ total: sql<number>`coalesce(sum(${tokenUsage.totalTokens}),0)` })
        .from(tokenUsage)
        .where(and(
          eq(tokenUsage.groupId, groupId),
          eq(tokenUsage.userId, userId),
          eq(tokenUsage.model, modelName)
        ))
      if ((usedModel?.total || 0) >= modelQuota.limitTokens) {
        return NextResponse.json(
          { error: "此模型額度已用完，請聯絡管理員。" },
          { status: 403 }
        )
      }
    }

    if (groupModelQuota?.limitTokens != null) {
      const [usedGroupModel] = await db
        .select({ total: sql<number>`coalesce(sum(${tokenUsage.totalTokens}),0)` })
        .from(tokenUsage)
        .where(and(eq(tokenUsage.groupId, groupId), eq(tokenUsage.model, modelName)))
      if ((usedGroupModel?.total || 0) >= groupModelQuota.limitTokens) {
        return NextResponse.json(
          { error: "群組該模型總額度已用完，請聯絡管理員。" },
          { status: 403 }
        )
      }
    }
  }

  const requestBody = {
    parts: [{ type: "text", text }],
    // OpenCode message API supports sending both agent and model.
    // Keep model override even when agent is specified.
    model: resolvedModel,
    agent: body.agent || undefined,
  }

  try {
    await ensureAgentSessionRecord({
      userId,
      opencodeSessionId: id,
    })

    const { response, path } = await opencodeFetchWithFallback(
      [
        `/session/${id}/prompt_async`,
        `/session/${id}/message`,
        `/session/${id}/prompt`,
      ],
      {
        method: "POST",
        body: requestBody,
        baseUrl,
      }
    )
    const payload = await readResponsePayload(response)

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to send prompt", details: payload },
        { status: response.status }
      )
    }

    if (path.endsWith("/prompt_async")) {
      return NextResponse.json({ accepted: true })
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
      // Non-blocking: prompt was accepted by OpenCode even if sync failed.
    }

    return NextResponse.json(payload?.data ?? payload ?? {})
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to reach OpenCode", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}
