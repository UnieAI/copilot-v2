import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { userProviders } from "@/lib/db/schema"
import { getGroupModels } from "@/lib/get-group-models"

export type AvailableModel = {
  value: string
  label: string
  providerName: string
  providerPrefix: string
  source: "user" | "group"
  groupId?: string
  groupName?: string
}

export async function getAvailableModelsForUser(userId: string): Promise<AvailableModel[]> {
  const providers = await db.query.userProviders.findMany({
    where: and(eq(userProviders.userId, userId), eq(userProviders.enable, 1)),
  })

  const userModels: AvailableModel[] = []
  for (const provider of providers) {
    const prefix = String(provider.prefix || "").toUpperCase()
    if (!prefix) continue

    const models = Array.isArray(provider.modelList) ? (provider.modelList as any[]) : []
    for (const model of models) {
      const modelID = String(model?.id || model || "")
      if (!modelID) continue

      userModels.push({
        value: `${prefix}-${modelID}`,
        label: modelID,
        providerName: provider.displayName || prefix,
        providerPrefix: prefix,
        source: "user",
      })
    }
  }

  const groupModels = await getGroupModels(userId)
  const merged = [...userModels, ...groupModels]

  const deduped: AvailableModel[] = []
  const seen = new Set<string>()
  for (const model of merged) {
    if (seen.has(model.value)) continue
    seen.add(model.value)
    deduped.push(model)
  }

  return deduped
}

export type ProviderWithKeys = {
  id: string
  providerName: string
  apiUrl: string
  apiKey: string
  models: Array<{ id: string; name: string }>
}

export async function getProvidersWithKeysForUser(userId: string): Promise<ProviderWithKeys[]> {
  const providers: ProviderWithKeys[] = []

  // 1. User providers
  const userProvs = await db.query.userProviders.findMany({
    where: and(eq(userProviders.userId, userId), eq(userProviders.enable, 1)),
  })

  for (const p of userProvs) {
    const prefix = String(p.prefix || "").toUpperCase()
    if (!prefix) continue

    const rawModels = Array.isArray(p.modelList) ? p.modelList : []
    const models = rawModels
      .map((m: any) => ({
        id: String(m?.id || m || ""),
        name: String(m?.name || m?.id || m || ""),
      }))
      .filter((m) => m.id)

    if (models.length > 0) {
      providers.push({
        id: prefix,
        providerName: p.displayName || prefix,
        apiUrl: p.apiUrl,
        apiKey: p.apiKey,
        models,
      })
    }
  }

  // 2. Group providers
  const { userGroups, groups, groupProviders } = await import("@/lib/db/schema")
  const memberships = await db.query.userGroups.findMany({
    where: eq(userGroups.userId, userId),
  })

  for (const membership of memberships) {
    const groupProvs = await db.query.groupProviders.findMany({
      where: and(eq(groupProviders.groupId, membership.groupId), eq(groupProviders.enable, 1)),
    })

    for (const p of groupProvs) {
      const prefix = String(p.prefix || "").toUpperCase()
      if (!prefix) continue

      const selectedIds = Array.isArray(p.selectedModels) ? (p.selectedModels as string[]) : []
      if (selectedIds.length === 0) continue

      const rawModels = Array.isArray(p.modelList) ? p.modelList : []
      const modelsToExpose = rawModels.filter((m: any) => selectedIds.includes(String(m?.id || m)))

      const models = modelsToExpose
        .map((m: any) => ({
          id: String(m?.id || m || ""),
          name: String(m?.name || m?.id || m || ""),
        }))
        .filter((m) => m.id)

      if (models.length > 0) {
        // Only add if we don't already have this prefix (user providers override group providers)
        if (!providers.some(existing => existing.id === prefix)) {
          providers.push({
            id: prefix,
            providerName: p.displayName || prefix,
            apiUrl: p.apiUrl,
            apiKey: p.apiKey,
            models,
          })
        }
      }
    }
  }

  return providers
}
