import { auth } from "@/auth"
import { db } from "@/lib/db"
import { chatSessions } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"

function requireAdminRole(role?: string | null) {
  return role === "admin" || role === "super"
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth()
  const role = (session?.user as any)?.role as string | undefined
  if (!session?.user || !requireAdminRole(role)) return new Response("Forbidden", { status: 403 })

  const { userId } = await params

  const sessions = await db.query.chatSessions.findMany({
    where: eq(chatSessions.userId, userId),
    orderBy: [desc(chatSessions.updatedAt)],
    columns: {
      id: true,
      title: true,
      updatedAt: true,
    },
  })

  return Response.json(sessions)
}
