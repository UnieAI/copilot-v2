"use server"

import { db } from "@/lib/db"
import { auth } from "@/auth"
import { mcpTools } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import {
  createUserAgentSkill,
  deleteUserAgentMcpServer,
  deleteUserAgentSkill,
  replaceUserAgentMcpServer,
  toggleUserAgentSkill,
  toggleUserAgentMcpServer,
  updateUserAgentSkill,
  upsertUserAgentMcpServer,
} from "@/lib/agent/runtime"
import type { AgentRemoteMcpServerConfig } from "@/lib/agent/mcp-config"
import type { AgentSkillDefinition } from "@/lib/agent/skill-config"

// ─── MCP Tool Actions ──────────────────────────────────────────────────────

export async function actionAddMcpTool(data: {
    url: string
    path: string
    key: string
    name: string
    description: string
}) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")
    const userId = session.user.id as string

    await db.insert(mcpTools).values({
        userId,
        url: data.url,
        path: data.path,
        key: data.key || null,
        type: "openapi",
        auth_type: data.key ? "bearer" : "none",
        spec_type: "openapi",
        spec: "",           // spec is fetched at runtime via url/path
        info: { name: data.name, description: data.description },
        config: {},
    })
    revalidatePath("/settings")
}

export async function actionUpdateMcpTool(id: string, data: {
    url: string
    path: string
    key: string
    name: string
    description: string
}) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")
    const userId = session.user.id as string

    await db.update(mcpTools).set({
        url: data.url,
        path: data.path,
        key: data.key || null,
        auth_type: data.key ? "bearer" : "none",
        info: { name: data.name, description: data.description },
        updatedAt: new Date(),
    }).where(and(eq(mcpTools.id, id), eq(mcpTools.userId, userId)))
    revalidatePath("/settings")
}

export async function actionDeleteMcpTool(id: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")
    const userId = session.user.id as string
    await db.delete(mcpTools).where(and(eq(mcpTools.id, id), eq(mcpTools.userId, userId)))
    revalidatePath("/settings")
}

export async function actionToggleMcpTool(id: string, currentIsActive: number) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")
    const userId = session.user.id as string
    await db.update(mcpTools).set({
        isActive: currentIsActive === 1 ? 0 : 1,
        updatedAt: new Date(),
    }).where(and(eq(mcpTools.id, id), eq(mcpTools.userId, userId)))
    revalidatePath("/settings")
}

type AgentMcpHeaderInput = {
    key: string
    value: string
}

type AgentMcpServerInput = {
    id: string
    url: string
    enabled: boolean
    timeoutMs: number | null
    disableOauth: boolean
    headers: AgentMcpHeaderInput[]
}

function sanitizeAgentMcpServerInput(data: AgentMcpServerInput) {
    const id = String(data.id || "").trim()
    const url = String(data.url || "").trim()

    if (!id) throw new Error("Server ID is required")
    if (!url) throw new Error("Server URL is required")

    const headers = Object.fromEntries(
        (Array.isArray(data.headers) ? data.headers : [])
            .map((entry) => [String(entry.key || "").trim(), String(entry.value || "").trim()] as const)
            .filter(([key, value]) => key && value)
    )

    const config: AgentRemoteMcpServerConfig = {
        type: "remote",
        url,
        enabled: Boolean(data.enabled),
    }

    if (Object.keys(headers).length > 0) {
        config.headers = headers
    }

    if (typeof data.timeoutMs === "number" && Number.isFinite(data.timeoutMs) && data.timeoutMs > 0) {
        config.timeout = Math.max(1000, Math.min(300000, Math.round(data.timeoutMs)))
    }

    if (data.disableOauth) {
        config.oauth = false
    }

    return { id, config }
}

export async function actionAddAgentMcpServer(data: AgentMcpServerInput) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await upsertUserAgentMcpServer(session.user.id as string, sanitizeAgentMcpServerInput(data))
    revalidatePath("/settings")
}

export async function actionUpdateAgentMcpServer(previousId: string, data: AgentMcpServerInput) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const normalizedPreviousId = String(previousId || "").trim()
    if (!normalizedPreviousId) throw new Error("Previous server ID is required")

    await replaceUserAgentMcpServer(
        session.user.id as string,
        normalizedPreviousId,
        sanitizeAgentMcpServerInput(data),
    )
    revalidatePath("/settings")
}

export async function actionDeleteAgentMcpServer(id: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const serverId = String(id || "").trim()
    if (!serverId) throw new Error("Server ID is required")

    await deleteUserAgentMcpServer(session.user.id as string, serverId)
    revalidatePath("/settings")
}

export async function actionToggleAgentMcpServer(id: string, enabled: boolean) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const serverId = String(id || "").trim()
    if (!serverId) throw new Error("Server ID is required")

    await toggleUserAgentMcpServer(session.user.id as string, serverId, Boolean(enabled))
    revalidatePath("/settings")
}

type AgentSkillInput = Omit<AgentSkillDefinition, "id">

function sanitizeAgentSkillInput(input: AgentSkillInput): AgentSkillInput {
    return {
        name: String(input.name || "").trim(),
        description: String(input.description || "").trim(),
        content: String(input.content || "").trim(),
        isEnabled: Boolean(input.isEnabled),
    }
}

export async function actionAddAgentSkill(input: AgentSkillInput) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await createUserAgentSkill(session.user.id as string, sanitizeAgentSkillInput(input))
    revalidatePath("/settings")
}

export async function actionUpdateAgentSkill(id: string, input: AgentSkillInput) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const skillId = String(id || "").trim()
    if (!skillId) throw new Error("Skill ID is required")

    await updateUserAgentSkill(session.user.id as string, skillId, sanitizeAgentSkillInput(input))
    revalidatePath("/settings")
}

export async function actionDeleteAgentSkill(id: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const skillId = String(id || "").trim()
    if (!skillId) throw new Error("Skill ID is required")

    await deleteUserAgentSkill(session.user.id as string, skillId)
    revalidatePath("/settings")
}

export async function actionToggleAgentSkill(id: string, isEnabled: boolean) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const skillId = String(id || "").trim()
    if (!skillId) throw new Error("Skill ID is required")

    await toggleUserAgentSkill(session.user.id as string, skillId, Boolean(isEnabled))
    revalidatePath("/settings")
}
