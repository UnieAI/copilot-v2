import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { userProviders, userPreferences, chatMessages, chatSessions } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { ChatInterface } from "@/components/chat/chat-interface"
import { getGroupModels } from "@/lib/get-group-models"
import { getGlobalModels } from "@/lib/get-global-models"

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const session = await auth()
    if (!session?.user?.id) redirect('/login')

    const userId = session.user.id as string
    const params = await searchParams
    const modeRaw = params.mode
    const mode = Array.isArray(modeRaw) ? modeRaw[0] : modeRaw
    const initialMode: "normal" | "agent" = mode === "agent" ? "agent" : "normal"
    const idRaw = params.id
    const requestedId = Array.isArray(idRaw) ? idRaw[0] : idRaw
    const sessionId = initialMode === "normal" ? requestedId : undefined
    const initialAgentSessionId = initialMode === "agent" ? requestedId : undefined
    const initialQuery = params.q as string | undefined
    const freshKey = (params.fresh as string | undefined) || (params.new as string | undefined) || ''

    // Fetch enabled providers with their model lists
    const providers = await db.query.userProviders.findMany({
        where: and(eq(userProviders.userId, userId), eq(userProviders.enable, 1)),
    })

    // Build flat model option list: value = "{prefix}-{modelId}"
    const availableModels = [
        ...providers.flatMap(p => {
            const selectedIds = Array.isArray((p as any).selectedModels) ? ((p as any).selectedModels as string[]) : []
            if (selectedIds.length === 0) return []
            const allModels = Array.isArray(p.modelList) ? (p.modelList as any[]) : []
            const models = allModels.filter((m: any) => selectedIds.includes(m.id || String(m)))
            return models.map((m: any) => ({
                value: `${p.prefix}-${m.id || String(m)}`,
                label: m.id || String(m),
                providerName: p.displayName || p.prefix,
                providerPrefix: p.prefix,
                source: 'user' as const,
            }))
        }),
        ...(await getGroupModels(userId)),
        ...(await getGlobalModels()),
    ]

    // Fetch user preference for previously selected model
    const pref = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
    })

    // Determine initial model value: preference → first available
    let initialSelectedModel = availableModels[0]?.value || ""
    if (pref?.selectedModel && pref?.selectedProviderPrefix) {
        const compositeValue = `${pref.selectedProviderPrefix}-${pref.selectedModel}`
        if (availableModels.some(m => m.value === compositeValue)) {
            initialSelectedModel = compositeValue
        }
    }

    // Load messages and system prompt for the current session (if provided)
    let initialMessages: any[] = []
    let initialSystemPrompt = ""
    if (sessionId) {
        const chatSession = await db.query.chatSessions.findFirst({
            where: and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
            columns: { systemPrompt: true },
        })
        initialSystemPrompt = chatSession?.systemPrompt ?? ""

        initialMessages = await db.query.chatMessages.findMany({
            where: and(
                eq(chatSessions.id, sessionId),
                eq(chatSessions.userId, userId),
                eq(chatSessions.mode, "normal")
            ),
            columns: { id: true }
        })

        if (targetSession) {
            initialMessages = await db.query.chatMessages.findMany({
                where: and(
                    eq(chatMessages.sessionId, sessionId),
                    eq(chatMessages.userId, userId)
                ),
                orderBy: (m, { asc }) => [asc(m.createdAt)]
            })
        }
    }

    return (
        <ChatInterface
            session={session}
            key={sessionId || freshKey || 'new'}
            sessionId={sessionId}
            availableModels={availableModels}
            initialSelectedModel={initialSelectedModel}
            initialSystemPrompt={initialSystemPrompt}
            initialMessages={initialMessages}
            initialQuery={initialQuery as string | undefined}
            initialMode={initialMode}
            initialAgentSessionId={initialAgentSessionId}
        />
    )
}
