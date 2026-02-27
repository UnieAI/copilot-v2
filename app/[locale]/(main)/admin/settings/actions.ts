"use server"

import { db } from "@/lib/db"
import { adminSettings } from "@/lib/db/schema"
import { auth } from "@/auth"

export const adminConfigActions = async (formData: FormData) => {
    const session = await auth()
    if (!session || !session.user || ((session.user as any).role !== 'admin' && (session.user as any).role !== 'super')) {
        throw new Error("Unauthorized")
    }

    const defaultUserRole = formData.get('defaultUserRole') as string || 'pending'
    const pendingMessage = formData.get('pendingMessage') as string || 'Your account is pending administrator approval.'
    const workModelUrl = formData.get('workModelUrl') as string
    const workModelKey = formData.get('workModelKey') as string
    const workModelName = formData.get('workModelName') as string

    const taskModelUrl = formData.get('taskModelUrl') as string
    const taskModelKey = formData.get('taskModelKey') as string
    const taskModelName = formData.get('taskModelName') as string

    const visionModelUrl = formData.get('visionModelUrl') as string
    const visionModelKey = formData.get('visionModelKey') as string
    const visionModelName = formData.get('visionModelName') as string

    // Update Singleton Settings
    const existing = await db.query.adminSettings.findFirst()

    const payload = {
        defaultUserRole, pendingMessage,
        workModelUrl, workModelKey, workModelName,
        taskModelUrl, taskModelKey, taskModelName,
        visionModelUrl, visionModelKey, visionModelName,
        updatedAt: new Date()
    }

    if (existing) {
        await db.update(adminSettings).set(payload)
    } else {
        await db.insert(adminSettings).values(payload)
    }

    return { success: true }
}
