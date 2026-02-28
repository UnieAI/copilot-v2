import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { adminSettings, userProviders } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * GET /api/setup-check
 * Returns which setup issues exist for the current user.
 * - adminIssues: present only for admin/super, lists missing system model fields
 * - providerIssues: present for all, true if no enabled provider has any models
 */
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

    const userId = session.user.id as string
    const role = (session.user as any).role as string
    const isAdmin = role === "admin" || role === "super"

    const checks = await Promise.all([
        // Admin: check system model settings
        isAdmin
            ? db.query.adminSettings.findFirst().then(s => {
                const missing: string[] = []
                if (!s || (!s.workModelName && !s.workModelUrl)) missing.push("System Model（Work Model）")
                if (!s || (!s.taskModelName && !s.taskModelUrl)) missing.push("Task Model（MCP Tool Decision）")
                if (!s || (!s.visionModelName && !s.visionModelUrl)) missing.push("Vision Model")
                return missing
            })
            : Promise.resolve(null),

        // All users: check own providers
        db.query.userProviders.findMany({
            where: eq(userProviders.userId, userId),
        }).then(providers => {
            const enabledWithModels = providers.filter(p => {
                const hasModels = Array.isArray(p.modelList) && (p.modelList as any[]).length > 0
                return p.enable === 1 && hasModels
            })
            return enabledWithModels.length === 0
        }),
    ])

    const [adminMissing, noProviders] = checks

    return Response.json({
        adminIssues: adminMissing && adminMissing.length > 0 ? adminMissing : null,
        providerIssue: noProviders,
    })
}
