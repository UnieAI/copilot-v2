import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/** PATCH /api/user/profile — update display name */
export async function PATCH(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })
    const userId = session.user.id as string

    const body = await req.json().catch(() => ({}))
    const name = (body.name as string)?.trim()
    if (!name) return new Response("Name is required", { status: 400 })

    await db.update(users).set({ name }).where(eq(users.id, userId))
    return Response.json({ ok: true, name })
}
