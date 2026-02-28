import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { chatSessions, userModels, mcpTools, chatMessages } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { ChatInterface } from "@/components/chat/chat-interface"

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const session = await auth()
    if (!session?.user?.id) redirect('/login')

    const userId = session.user.id as string
    const params = await searchParams
    const sessionId = params.id as string | undefined
    const initialQuery = params.q as string | undefined

    const userModelConf = await db.query.userModels.findFirst({
        where: eq(userModels.userId, userId)
    })

    const availableModels = userModelConf && Array.isArray(userModelConf.modelList)
        ? (userModelConf.modelList as any[]).map((m: any) => String(m.id || m))
        : []

    // Load messages for the current session
    let initialMessages: any[] = []
    if (sessionId) {
        initialMessages = await db.query.chatMessages.findMany({
            where: and(
                eq(chatMessages.sessionId, sessionId),
                eq(chatMessages.userId, userId)
            ),
            orderBy: [desc(chatMessages.createdAt)]
        })
        initialMessages.reverse()
    }

    return (
        <ChatInterface
            sessionId={sessionId}
            availableModels={availableModels}
            initialMessages={initialMessages}
            initialQuery={initialQuery as string | undefined}
        />
    )
}
