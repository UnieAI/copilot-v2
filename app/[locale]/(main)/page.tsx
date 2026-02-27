import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { chatSessions, userModels } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { ChatInterface } from "@/components/chat/chat-interface"

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
    const session = await auth()
    if (!session || !session.user || !session.user.id) redirect('/login')

    const userId = session.user.id as string
    const id = (await searchParams).id;

    const allSessions = await db.query.chatSessions.findMany({
        where: eq(chatSessions.userId, userId),
        orderBy: [desc(chatSessions.updatedAt)]
    })

    const userModelConf = await db.query.userModels.findFirst({
        where: eq(userModels.userId, userId)
    })

    const availableModels = userModelConf && Array.isArray(userModelConf.modelList)
        ? userModelConf.modelList.map((m: any) => String(m.id))
        : []

    return (
        <div className="flex h-full w-full">
            {/* Session History Sidebar */}
            <div className="w-64 border-r h-full flex flex-col bg-muted/10 p-4">
                <a href="/" className="mb-4 bg-primary text-primary-foreground text-center py-2 rounded font-medium">+ New Chat</a>
                <div className="flex-1 overflow-y-auto space-y-2">
                    {allSessions.map(s => (
                        <a key={s.id} href={`/?id=${s.id}`} className={`block p-2 text-sm rounded truncate ${id === s.id ? 'bg-accent' : 'hover:bg-accent/50'}`}>
                            {s.title}
                        </a>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 h-full">
                <ChatInterface
                    sessionId={id}
                    availableModels={availableModels}
                />
            </div>
        </div>
    )
}
