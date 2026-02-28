import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { chatSessions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const userId = session.user.id as string;
    const sessions = await db.query.chatSessions.findMany({
        where: eq(chatSessions.userId, userId),
        orderBy: [desc(chatSessions.updatedAt)],
        columns: { id: true, title: true, updatedAt: true }
    });

    return Response.json(sessions);
}
