"use server"

import { db } from "@/lib/db"
import { auth } from "@/auth"
import { mcpTools } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"

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
