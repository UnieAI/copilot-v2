import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { chatProjects, chatSessions, chatMessages, userProviders, userPreferences } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { ProjectPageClient } from "@/components/project/project-page-client"
import { getGroupModels } from "@/lib/get-group-models"

export default async function ProjectChatPage({
    params,
}: {
    params: Promise<{ id: string; c_id: string }>
}) {
    const session = await auth()
    if (!session?.user?.id) redirect('/login')

    const userId = session.user.id as string
    const { id: projectId, c_id: chatId } = await params

    // Verify the project belongs to this user
    const project = await db.query.chatProjects.findFirst({
        where: and(eq(chatProjects.id, projectId), eq(chatProjects.userId, userId)),
    })
    if (!project) redirect('/chat')

    // Verify the chat belongs to this project and user
    const chatSession = await db.query.chatSessions.findFirst({
        where: and(
            eq(chatSessions.id, chatId),
            eq(chatSessions.userId, userId),
            eq(chatSessions.projectId, projectId),
        ),
    })
    if (!chatSession) redirect(`/p/${projectId}`)

    // Get all chats in this project
    const projectSessions = await db.query.chatSessions.findMany({
        where: and(eq(chatSessions.projectId, projectId), eq(chatSessions.userId, userId)),
        orderBy: (s, { desc }) => [desc(s.updatedAt)],
    })

    // Load messages for the active chat
    const activeMessages = await db.query.chatMessages.findMany({
        where: and(eq(chatMessages.sessionId, chatId), eq(chatMessages.userId, userId)),
        orderBy: (m, { asc }) => [asc(m.createdAt)],
    })

    // Enabled providers for model selector
    const providers = await db.query.userProviders.findMany({
        where: and(eq(userProviders.userId, userId), eq(userProviders.enable, 1)),
    })
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

    // Determine selected model (from chat session, then preference, then first)
    let initialSelectedModel = availableModels[0]?.value || ""
    if (chatSession.modelName && chatSession.providerPrefix) {
        const compositeValue = `${chatSession.providerPrefix}-${chatSession.modelName}`
        if (availableModels.some(m => m.value === compositeValue)) {
            initialSelectedModel = compositeValue
        }
    } else {
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

    return (
        <ProjectPageClient
            project={{ id: project.id, name: project.name }}
            initialSessions={projectSessions.map(s => ({
                id: s.id,
                title: s.title,
                updatedAt: String(s.updatedAt),
            }))}
            availableModels={availableModels}
            initialSelectedModel={initialSelectedModel}
            initialActiveSessionId={chatId}
            initialActiveMessages={activeMessages.map(m => ({
                id: m.id,
                role: m.role as "user" | "assistant" | "system",
                content: m.content,
                attachments: Array.isArray(m.attachments)
                    ? (m.attachments as any[]).map((a: any) => ({
                        name: a.name,
                        mimeType: a.mimeType,
                        base64: a.base64 || undefined,
                    }))
                    : [],
            }))}
        />
    )
}
