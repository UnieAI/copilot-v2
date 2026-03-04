import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { chatMessages, chatSessions } from "@/lib/db/schema"

type AgentRole = "user" | "assistant" | "system"

type NormalizedAgentMessage = {
  externalMessageId: string
  role: AgentRole
  content: string
  toolCalls: unknown[]
  createdAt?: Date
  modelName?: string | null
  providerPrefix?: string | null
}

function normalizeRole(input: unknown): AgentRole {
  const role = String(input || "assistant").toLowerCase()
  if (role === "user" || role === "assistant" || role === "system") return role
  return "assistant"
}

function toDate(value: unknown): Date | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  const millis = value > 1e12 ? value : value * 1000
  const date = new Date(millis)
  if (Number.isNaN(date.getTime())) return undefined
  return date
}

function truncateTitle(text: string) {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return "Agent Session"
  return clean.length > 30 ? `${clean.slice(0, 30)}...` : clean
}

function extractText(parts: any[]): string {
  const text = parts
    .filter((part) => part?.type === "text" && typeof part?.text === "string")
    .map((part) => String(part.text).trim())
    .filter(Boolean)
    .join("\n\n")

  if (text) return text

  const tools = parts
    .filter((part) => part?.type === "tool")
    .map((part) => {
      const name = String(part?.tool || "tool")
      const status = part?.state?.status ? ` [${String(part.state.status)}]` : ""
      return `${name}${status}`
    })

  return tools.join("\n")
}

function normalizeAgentMessages(opencodeSessionId: string, payload: any): NormalizedAgentMessage[] {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.messages)
      ? payload.messages
      : Array.isArray(payload?.data)
        ? payload.data
        : []

  return list.map((item: any, idx: number) => {
    const info = item?.info || item || {}
    const externalMessageId = String(info.id || item?.id || `${opencodeSessionId}:${idx}`)
    const role = normalizeRole(info.role || item?.role)
    const parts = Array.isArray(item?.parts)
      ? item.parts
      : typeof item?.content === "string"
        ? [{ type: "text", text: item.content }]
        : []

    const content = extractText(parts)
    const toolCalls = parts.filter((part: any) => part?.type === "tool")

    const model = info?.model && typeof info.model === "object" ? info.model : null
    const providerPrefix = model?.providerID ? String(model.providerID) : null
    const modelName = model?.modelID ? String(model.modelID) : null

    return {
      externalMessageId,
      role,
      content,
      toolCalls,
      createdAt: toDate(info?.time?.created),
      providerPrefix,
      modelName,
    }
  })
}

function inferTitle(messages: NormalizedAgentMessage[], fallbackTitle?: string) {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim())
  if (firstUser) return truncateTitle(firstUser.content)
  if (fallbackTitle?.trim()) return truncateTitle(fallbackTitle)
  return "Agent Session"
}

export async function ensureAgentSessionRecord(opts: {
  userId: string
  opencodeSessionId: string
  title?: string
}) {
  const { userId, opencodeSessionId, title } = opts

  const existing = await db.query.chatSessions.findFirst({
    where: and(
      eq(chatSessions.userId, userId),
      eq(chatSessions.mode, "agent"),
      eq(chatSessions.externalSessionId, opencodeSessionId)
    ),
  })

  if (existing) {
    const shouldUpdateTitle =
      !!title && (existing.title === "New Chat" || existing.title === "Agent Session")

    if (shouldUpdateTitle) {
      await db
        .update(chatSessions)
        .set({ title: truncateTitle(title || ""), updatedAt: new Date() })
        .where(eq(chatSessions.id, existing.id))
    }

    return existing.id
  }

  try {
    const [created] = await db
      .insert(chatSessions)
      .values({
        userId,
        title: truncateTitle(title || "Agent Session"),
        modelName: "agent",
        providerPrefix: null,
        mode: "agent",
        externalSessionId: opencodeSessionId,
        projectId: null,
      })
      .returning({ id: chatSessions.id })

    return created.id
  } catch {
    const retried = await db.query.chatSessions.findFirst({
      where: and(
        eq(chatSessions.userId, userId),
        eq(chatSessions.mode, "agent"),
        eq(chatSessions.externalSessionId, opencodeSessionId)
      ),
      columns: { id: true },
    })
    if (retried?.id) return retried.id
    throw new Error("Failed to create agent session record")
  }
}

export async function syncAgentSessionFromPayload(opts: {
  userId: string
  opencodeSessionId: string
  payload: any
  fallbackTitle?: string
}) {
  const { userId, opencodeSessionId, payload, fallbackTitle } = opts

  const normalized = normalizeAgentMessages(opencodeSessionId, payload)
  const inferredTitle = inferTitle(normalized, fallbackTitle)
  const sessionId = await ensureAgentSessionRecord({
    userId,
    opencodeSessionId,
    title: inferredTitle,
  })

  const currentSession = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.id, sessionId),
    columns: { title: true },
  })

  const existingMessages = await db.query.chatMessages.findMany({
    where: and(eq(chatMessages.userId, userId), eq(chatMessages.sessionId, sessionId)),
    columns: {
      id: true,
      externalMessageId: true,
      content: true,
      role: true,
      toolCalls: true,
    },
  })

  const existingMap = new Map<string, (typeof existingMessages)[number]>()
  for (const message of existingMessages) {
    if (message.externalMessageId) {
      existingMap.set(message.externalMessageId, message)
    }
  }

  const touchedExternalIds = new Set<string>()
  let newestAt = new Date()

  for (const message of normalized) {
    touchedExternalIds.add(message.externalMessageId)
    const nextCreatedAt = message.createdAt || new Date()
    if (nextCreatedAt > newestAt) newestAt = nextCreatedAt

    const current = existingMap.get(message.externalMessageId)
    if (!current) {
      await db.insert(chatMessages).values({
        sessionId,
        userId,
        role: message.role,
        content: message.content || "",
        toolCalls: message.toolCalls as any,
        attachments: [] as any,
        externalMessageId: message.externalMessageId,
        createdAt: nextCreatedAt,
      })
      continue
    }

    const nextToolCalls = JSON.stringify(message.toolCalls || [])
    const currentToolCalls = JSON.stringify(current.toolCalls || [])
    if (current.content !== message.content || current.role !== message.role || nextToolCalls !== currentToolCalls) {
      await db
        .update(chatMessages)
        .set({
          role: message.role,
          content: message.content || "",
          toolCalls: message.toolCalls as any,
        })
        .where(eq(chatMessages.id, current.id))
    }
  }

  const staleIds = existingMessages
    .filter((m) => m.externalMessageId && !touchedExternalIds.has(m.externalMessageId))
    .map((m) => m.id)

  if (staleIds.length > 0) {
    await db.delete(chatMessages).where(inArray(chatMessages.id, staleIds))
  }

  const latest = normalized[normalized.length - 1]
  const nextTitle =
    currentSession?.title === "New Chat" || currentSession?.title === "Agent Session"
      ? inferredTitle
      : (currentSession?.title || inferredTitle)

  await db
    .update(chatSessions)
    .set({
      updatedAt: newestAt,
      mode: "agent",
      externalSessionId: opencodeSessionId,
      modelName: latest?.modelName || "agent",
      providerPrefix: latest?.providerPrefix || null,
      title: nextTitle,
    })
    .where(eq(chatSessions.id, sessionId))

  return { sessionId, count: normalized.length }
}
