"use server"

import { db } from "@/lib/db"
import { adminSettings } from "@/lib/db/schema"
import { auth } from "@/auth"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { normalizeAdminAgentDefaults, normalizeAgentSettingsInput, updateUserAgentSettings } from "@/lib/agent/runtime"

export const adminConfigActions = async (formData: FormData) => {
    const session = await auth()
    if (!session || !session.user || ((session.user as any).role !== 'admin' && (session.user as any).role !== 'super')) {
        throw new Error("Unauthorized")
    }

    const existing = await db.query.adminSettings.findFirst()
    const payload: Partial<typeof adminSettings.$inferInsert> = {}

    type StringFieldKey =
        | "workModelUrl"
        | "workModelKey"
        | "workModelName"
        | "taskModelUrl"
        | "taskModelKey"
        | "taskModelName"
        | "visionModelUrl"
        | "visionModelKey"
        | "visionModelName"

    const assignString = (key: StringFieldKey) => {
        if (!formData.has(key)) return
        payload[key] = (formData.get(key) as string) ?? ""
    }

    if (formData.has("defaultUserRole")) {
        payload.defaultUserRole = ((formData.get("defaultUserRole") as string) || "pending").trim()
    }
    if (formData.has("pendingMessage")) {
        payload.pendingMessage =
            ((formData.get("pendingMessage") as string) || "Your account is pending administrator approval.").trim()
    }
    if (formData.has("fileAttachmentSessionOnly")) {
        payload.fileAttachmentSessionOnly = formData.get("fileAttachmentSessionOnly") === "true"
    }

    const hasAgentDefaults =
        formData.has("agentDefaultWorkspacePersistence") ||
        formData.has("agentDefaultMemoryMb") ||
        formData.has("agentDefaultCpuMillicores") ||
        formData.has("agentDefaultPidLimit") ||
        formData.has("agentDefaultIdleTimeoutMinutes") ||
        formData.has("agentPortRangeStart") ||
        formData.has("agentPortRangeEnd")

    if (hasAgentDefaults) {
        const normalized = normalizeAdminAgentDefaults({
            agentDefaultWorkspacePersistence: formData.get("agentDefaultWorkspacePersistence") === "true",
            agentDefaultMemoryMb: Number(formData.get("agentDefaultMemoryMb") || 0),
            agentDefaultCpuMillicores: Number(formData.get("agentDefaultCpuMillicores") || 0),
            agentDefaultPidLimit: Number(formData.get("agentDefaultPidLimit") || 0),
            agentDefaultIdleTimeoutMinutes: Number(formData.get("agentDefaultIdleTimeoutMinutes") || 0),
            agentPortRangeStart: Number(formData.get("agentPortRangeStart") || 0),
            agentPortRangeEnd: Number(formData.get("agentPortRangeEnd") || 0),
        })

        payload.agentDefaultWorkspacePersistence = normalized.defaults.workspacePersistence
        payload.agentDefaultMemoryMb = normalized.defaults.memoryMb
        payload.agentDefaultCpuMillicores = normalized.defaults.cpuMillicores
        payload.agentDefaultPidLimit = normalized.defaults.pidLimit
        payload.agentDefaultIdleTimeoutMinutes = normalized.defaults.idleTimeoutMinutes
        payload.agentPortRangeStart = normalized.portRange.start
        payload.agentPortRangeEnd = normalized.portRange.end
    }

    assignString("workModelUrl")
    assignString("workModelKey")
    assignString("workModelName")
    assignString("taskModelUrl")
    assignString("taskModelKey")
    assignString("taskModelName")
    assignString("visionModelUrl")
    assignString("visionModelKey")
    assignString("visionModelName")

    if (Object.keys(payload).length === 0) {
        return { success: true }
    }
    payload.updatedAt = new Date()

    if (existing) {
        await db.update(adminSettings).set(payload).where(eq(adminSettings.id, existing.id))
    } else {
        await db.insert(adminSettings).values(payload)
    }

    return { success: true }
}

export const adminUpdateUserAgentSettingsAction = async (payload: {
    userId: string
    useCustomSettings: boolean
    workspacePersistence: boolean
    memoryMb: number
    cpuMillicores: number
    pidLimit: number
    idleTimeoutMinutes: number
}) => {
    const session = await auth()
    if (!session || !session.user || ((session.user as any).role !== 'admin' && (session.user as any).role !== 'super')) {
        throw new Error("Unauthorized")
    }

    if (!payload.userId) {
        throw new Error("Missing userId")
    }

    const normalized = normalizeAgentSettingsInput(payload)
    await updateUserAgentSettings(payload.userId, {
        useCustomSettings: Boolean(payload.useCustomSettings),
        ...normalized,
    })

    revalidatePath("/admin/settings")
    return { success: true }
}
