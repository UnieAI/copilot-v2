import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { userModels, chatMessages } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { ChatInterface } from "@/components/chat/chat-interface"

export default async function ChatSessionPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.id) redirect('/login')

    const userId = session.user.id as string
    const { id: sessionId } = await params

    const userModelConf = await db.query.userModels.findFirst({ where: eq(userModels.userId, userId) })
    const availableModels = userModelConf && Array.isArray(userModelConf.modelList)
        ? (userModelConf.modelList as any[]).map((m: any) => String(m.id || m))
        : []

    const initialMessages = await db.query.chatMessages.findMany({
        where: and(eq(chatMessages.sessionId, sessionId), eq(chatMessages.userId, userId)),
        orderBy: (m, { asc }) => [asc(m.createdAt)]
    })

    if (initialMessages.length === 0) {
        // Session doesn't belong to this user or doesn't exist
        redirect('/')
    }

    return (
        <ChatInterface
            sessionId={sessionId}
            availableModels={availableModels}
            initialMessages={initialMessages.map(m => ({
                id: m.id,
                role: m.role as "user" | "assistant" | "system",
                content: m.content,
                createdAt: String(m.createdAt),
                attachments: Array.isArray(m.attachments)
                    ? (m.attachments as any[]).map((a: any) => ({ name: a.name, mimeType: a.mimeType }))
                    : []
            }))}
        />
    )
}
