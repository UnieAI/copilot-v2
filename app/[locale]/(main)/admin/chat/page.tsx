import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { chatSessions, userPhotos, users } from "@/lib/db/schema"
import { asc, eq, sql } from "drizzle-orm"
import { ChatMonitorPanel } from "@/components/admin/chat-monitor-panel"

type ChatMonitorUser = {
  id: string
  name: string | null
  email: string
  image: string | null
  role: string
  chatCount: number
}

export default async function AdminChatPage() {
  const session = await auth()
  const myRole = (session?.user as any)?.role as string
  if (!session?.user || !["admin", "super"].includes(myRole)) redirect("/")

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: userPhotos.image,
      role: users.role,
      chatCount: sql<number>`count(${chatSessions.id})::int`,
    })
    .from(users)
    .leftJoin(userPhotos, eq(userPhotos.userId, users.id))
    .leftJoin(chatSessions, eq(chatSessions.userId, users.id))
    .groupBy(users.id, users.name, users.email, userPhotos.image, users.role)
    .orderBy(sql`count(${chatSessions.id}) desc`, asc(users.createdAt))

  const allUsers: ChatMonitorUser[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    image: r.image,
    role: r.role,
    chatCount: Number(r.chatCount || 0),
  }))

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="sticky top-0 z-10 flex-shrink-0 border-b border-border/40 bg-background/95 backdrop-blur px-6 py-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-xl md:text-2xl font-medium tracking-tight">聊天監控</h1>
          <p className="text-sm text-muted-foreground mt-0.5 font-normal">
            查看所有使用者對話清單，並快速檢視完整訊息內容。
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
        <div className="max-w-6xl mx-auto h-full">
          <ChatMonitorPanel users={allUsers} />
        </div>
      </div>
    </div>
  )
}
