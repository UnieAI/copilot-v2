"use server"

import { db } from "@/lib/db"
import { adminSettings } from "@/lib/db/schema"
import { auth } from "@/auth"
import { eq } from "drizzle-orm"

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
