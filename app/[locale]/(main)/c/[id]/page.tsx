import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { userProviders, userPreferences, chatMessages, chatSessions } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { ChatInterface } from "@/components/chat/chat-interface"
import { getGroupModels } from "@/lib/get-group-models"

export default async function ChatSessionPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.id) redirect('/login')

    const userId = session.user.id as string
    const { id: sessionId } = await params

    // Fetch enabled providers with their model lists
    const providers = await db.query.userProviders.findMany({
        where: and(eq(userProviders.userId, userId), eq(userProviders.enable, 1)),
    })

    // Build flat model option list: value = "{prefix}-{modelId}"
    const availableModels = [
        ...providers.flatMap(p => {
            const models = Array.isArray(p.modelList) ? (p.modelList as any[]) : []
            return models.map((m: any) => ({
                value: `${p.prefix}-${m.id || String(m)}`,
                label: m.id || String(m),
                providerName: p.displayName || p.prefix,
                providerPrefix: p.prefix,
                source: 'user' as const,
            }))
        }),
        ...(await getGroupModels(userId)),
    ]

    // Load messages
    const initialMessages = await db.query.chatMessages.findMany({
        where: and(eq(chatMessages.sessionId, sessionId), eq(chatMessages.userId, userId)),
        orderBy: (m, { asc }) => [asc(m.createdAt)]
    })

    if (initialMessages.length === 0) {
        redirect('/chat')
    }

    // Fetch the session to get stored model+provider
    const chatSession = await db.query.chatSessions.findFirst({
        where: and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
    })

    // Task 5: Determine initial model
    // If session has providerPrefix + modelName, build composite value and check if provider exists
    let initialSelectedModel = availableModels[0]?.value || ""

    if (chatSession?.modelName && chatSession?.providerPrefix) {
        const compositeValue = `${chatSession.providerPrefix}-${chatSession.modelName}`
        const exists = availableModels.some(m => m.value === compositeValue)
        if (exists) {
            initialSelectedModel = compositeValue
        } else {
            // Provider no longer exists — update session to use first available model
            if (availableModels.length > 0) {
                const [newPrefix, ...rest] = availableModels[0].value.split('-')
                const newModelName = rest.join('-')
                await db.update(chatSessions)
                    .set({
                        modelName: newModelName,
                        providerPrefix: newPrefix,
                        updatedAt: new Date(),
                    })
                    .where(eq(chatSessions.id, sessionId))
            }
        }
    } else if (chatSession?.modelName && !chatSession?.providerPrefix) {
        // Legacy session without providerPrefix — try to match model name in available models
        const matchByModelName = availableModels.find(m => m.label === chatSession.modelName)
        if (matchByModelName) {
            initialSelectedModel = matchByModelName.value
            // Upgrade session record to include providerPrefix
            await db.update(chatSessions)
                .set({
                    providerPrefix: matchByModelName.providerPrefix,
                    updatedAt: new Date(),
                })
                .where(eq(chatSessions.id, sessionId))
        } else {
            // Model not found in any provider — fall back to user preference or first model
            const pref = await db.query.userPreferences.findFirst({
                where: eq(userPreferences.userId, userId),
            })
            if (pref?.selectedModel && pref?.selectedProviderPrefix) {
                const compositeValue = `${pref.selectedProviderPrefix}-${pref.selectedModel}`
                if (availableModels.some(m => m.value === compositeValue)) {
                    initialSelectedModel = compositeValue
                }
            }
        }
    }

    return (
        <ChatInterface
            sessionId={sessionId}
            availableModels={availableModels}
            initialSelectedModel={initialSelectedModel}
            initialMessages={initialMessages.map(m => ({
                id: m.id,
                role: m.role as "user" | "assistant" | "system",
                content: m.content,
                createdAt: String(m.createdAt),
                attachments: Array.isArray(m.attachments)
                    ? (m.attachments as any[]).map((a: any) => ({
                        name: a.name,
                        mimeType: a.mimeType,
                        base64: a.base64 || undefined,
                    }))
                    : []
            }))}
        />
    )
}
