import { auth } from "@/auth"
import { db } from "@/lib/db"
import { chatMessages, chatSessions } from "@/lib/db/schema"
import { and, asc, eq } from "drizzle-orm"

function requireAdminRole(role?: string | null) {
  return role === "admin" || role === "super"
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string; sessionId: string }> }
) {
  const session = await auth()
  const role = (session?.user as any)?.role as string | undefined
  if (!session?.user || !requireAdminRole(role)) return new Response("Forbidden", { status: 403 })

  const { userId, sessionId } = await params

  const targetSession = await db.query.chatSessions.findFirst({
    where: and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
    columns: { id: true },
  })
  if (!targetSession) return new Response("Not found", { status: 404 })

  const messages = await db.query.chatMessages.findMany({
    where: and(eq(chatMessages.sessionId, sessionId), eq(chatMessages.userId, userId)),
    orderBy: [asc(chatMessages.createdAt)],
    columns: {
      id: true,
      role: true,
      content: true,
      attachments: true,
      createdAt: true,
    },
  })

  return Response.json(
    messages.map((m) => ({
      ...m,
      attachments: Array.isArray(m.attachments)
        ? (m.attachments as any[]).map((a: any) => ({
            name: a?.name || "file",
            mimeType: a?.mimeType || "application/octet-stream",
            base64: a?.base64 || undefined,
          }))
        : [],
    }))
  )
}
