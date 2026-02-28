import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { chatProjects, chatSessions, userProviders, userPreferences } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { ProjectPageClient } from "@/components/project/project-page-client"

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.id) redirect('/login')

    const userId = session.user.id as string
    const { id: projectId } = await params

    // Verify the project belongs to this user
    const project = await db.query.chatProjects.findFirst({
        where: and(eq(chatProjects.id, projectId), eq(chatProjects.userId, userId)),
    })
    if (!project) redirect('/chat')

    // Get all chats in this project, sorted by newest first
    const projectSessions = await db.query.chatSessions.findMany({
        where: and(eq(chatSessions.projectId, projectId), eq(chatSessions.userId, userId)),
        orderBy: (s, { desc }) => [desc(s.updatedAt)],
    })

    // Get enabled providers for model selector
    const providers = await db.query.userProviders.findMany({
        where: and(eq(userProviders.userId, userId), eq(userProviders.enable, 1)),
    })
    const availableModels = providers.flatMap(p => {
        const models = Array.isArray(p.modelList) ? (p.modelList as any[]) : []
        return models.map((m: any) => ({
            value: `${p.prefix}-${m.id || String(m)}`,
            label: m.id || String(m),
            providerName: p.displayName || p.prefix,
            providerPrefix: p.prefix,
        }))
    })

    // User preference for model
    const pref = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
    })
    let initialSelectedModel = availableModels[0]?.value || ""
    if (pref?.selectedModel && pref?.selectedProviderPrefix) {
        const compositeValue = `${pref.selectedProviderPrefix}-${pref.selectedModel}`
        if (availableModels.some(m => m.value === compositeValue)) {
            initialSelectedModel = compositeValue
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
        />
    )
}
