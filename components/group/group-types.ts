export type GroupRole = "creator" | "editor" | "member"

export type Group = {
    id: string
    name: string
    image?: string | null
    creatorId: string | null
    currentUserRole?: GroupRole | null
    memberCount: number
    providerCount: number
    createdAt: string
}

export type User = {
    id: string
    name: string | null
    email: string
    role: string
    image: string | null
}

export type Member = User & { membershipRole: GroupRole }

export type GroupProvider = {
    id: string
    groupId: string
    enable: number
    displayName: string
    prefix: string
    apiUrl: string
    apiKey: string
    modelList: any[]
    selectedModels: string[]
    updatedAt: string
}

export type UsageRow = {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null }
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

export type UsagePoint = {
    date: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

export type UsageByModelRow = {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null }
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

export type UserQuota = {
    userId: string
    limitTokens: number | null
    refillIntervalHours: number
    usedTokens?: number
    remainingTokens?: number | null
    refreshAt?: string
}

export type ModelQuota = {
    userId: string
    model: string
    limitTokens: number | null
    refillIntervalHours: number
    usedTokens?: number
    remainingTokens?: number | null
    refreshAt?: string
}

export type GroupModelQuota = {
    model: string
    limitTokens: number | null
    refillIntervalHours: number
    usedTokens?: number
    remainingTokens?: number | null
    refreshAt?: string
}

export function quotaHintText(q: { limitTokens: number | null; remainingTokens?: number | null; refreshAt?: string }) {
    if (q.limitTokens === null) return "無上限"
    if (q.remainingTokens === undefined) return `上限 ${q.limitTokens.toLocaleString()} tokens`
    const remaining = Number(q.remainingTokens ?? 0)
    if (remaining > 0) return `剩餘 ${remaining.toLocaleString()} tokens`
    return `已用盡，刷新時間 ${q.refreshAt ? new Date(q.refreshAt).toLocaleString() : "-"}`
}

export function maskKey(key: string) {
    if (!key || key.length < 6) return "••••••"
    return key.slice(0, 4) + "•".repeat(Math.min(key.length - 6, 12)) + key.slice(-2)
}

export const UNIEAI_PROVIDER_URL = process.env.NEXT_PUBLIC_UNIEAI_PROVIDER_URL || ""
export const UNIEAI_PROVIDER_KEY = process.env.NEXT_PUBLIC_UNIEAI_PROVIDER_KEY || ""
