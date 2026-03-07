import { db } from "@/lib/db"
import { globalProviders, groupProviders, userGroups, userProviders } from "@/lib/db/schema"
import { and, eq, inArray } from "drizzle-orm"

export type AgentProviderModel = {
  id: string
  name: string
}

export type AgentProvider = {
  id: string
  providerName: string
  apiUrl: string
  apiKey: string
  models: AgentProviderModel[]
}

function toSelectedModels(selectedModels: unknown, modelList: unknown): AgentProviderModel[] {
  const selected = Array.isArray(selectedModels) ? selectedModels.map((x) => String(x)) : []
  if (selected.length === 0) return []

  const all = Array.isArray(modelList) ? modelList : []
  const out: AgentProviderModel[] = []

  for (const item of all as any[]) {
    const id = String(item?.id ?? item ?? "")
    if (!id || !selected.includes(id)) continue
    out.push({
      id,
      name: String(item?.name ?? id),
    })
  }

  return out
}

function toAgentProvider(row: {
  prefix: string
  displayName: string
  apiUrl: string
  apiKey: string
  selectedModels: unknown
  modelList: unknown
}): AgentProvider | null {
  const models = toSelectedModels(row.selectedModels, row.modelList)
  if (models.length === 0) return null

  return {
    id: row.prefix,
    providerName: row.displayName || row.prefix,
    apiUrl: row.apiUrl,
    apiKey: row.apiKey,
    models,
  }
}

export async function getProvidersWithKeysForUser(userId: string): Promise<AgentProvider[]> {
  const byPrefix = new Map<string, AgentProvider>()

  const mine = await db.query.userProviders.findMany({
    where: and(eq(userProviders.userId, userId), eq(userProviders.enable, 1)),
  })

  for (const row of mine) {
    const provider = toAgentProvider(row)
    if (!provider) continue
    byPrefix.set(provider.id, provider)
  }

  const memberships = await db.query.userGroups.findMany({
    where: eq(userGroups.userId, userId),
  })
  const groupIds = memberships.map((m) => m.groupId)

  if (groupIds.length > 0) {
    const groupRows = await db.query.groupProviders.findMany({
      where: and(inArray(groupProviders.groupId, groupIds), eq(groupProviders.enable, 1)),
    })

    for (const row of groupRows) {
      const provider = toAgentProvider(row)
      if (!provider) continue
      if (!byPrefix.has(provider.id)) {
        byPrefix.set(provider.id, provider)
      }
    }
  }

  const globals = await db.query.globalProviders.findMany({
    where: eq(globalProviders.enable, 1),
  })

  for (const row of globals) {
    const provider = toAgentProvider(row)
    if (!provider) continue
    if (!byPrefix.has(provider.id)) {
      byPrefix.set(provider.id, provider)
    }
  }

  return [...byPrefix.values()]
}
