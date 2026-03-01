import { db } from "@/lib/db"
import { groupProviders, userGroups, groups } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * Returns group-sourced AvailableModel entries for the given user.
 * Only includes enabled providers. Filters model list by selectedModels if set.
 */
export async function getGroupModels(userId: string) {
    // Find all groups this user belongs to
    const memberships = await db.query.userGroups.findMany({
        where: eq(userGroups.userId, userId),
    })

    if (memberships.length === 0) return []

    const results: {
        value: string
        label: string
        providerName: string
        providerPrefix: string
        source: "group"
        groupId: string
        groupName: string
    }[] = []

    for (const membership of memberships) {
        // Get group name
        const group = await db.query.groups.findFirst({
            where: eq(groups.id, membership.groupId),
        })
        const groupName = group?.name || "Unknown Group"

        const providers = await db.query.groupProviders.findMany({
            where: eq(groupProviders.groupId, membership.groupId),
        })

        for (const p of providers) {
            if (!p.enable) continue

            // Only expose models that are explicitly in selectedModels
            // If selectedModels is empty, no models are exposed until admin selects some
            const selectedIds = Array.isArray(p.selectedModels) ? (p.selectedModels as string[]) : []
            if (selectedIds.length === 0) continue

            const allModels = Array.isArray(p.modelList) ? (p.modelList as any[]) : []
            const modelsToExpose = allModels.filter((m: any) => selectedIds.includes(m.id || String(m)))

            for (const m of modelsToExpose) {
                results.push({
                    value: `${p.prefix}-${m.id || String(m)}`,
                    label: m.id || String(m),
                    providerName: p.displayName || p.prefix,
                    providerPrefix: p.prefix,
                    source: "group" as const,
                    groupId: membership.groupId,
                    groupName,
                })
            }
        }
    }

    return results
}
