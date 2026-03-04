import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { chatSessions } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const userId = session.user.id as string;
    const requestedMode = req.nextUrl.searchParams.get("mode");
    const mode = requestedMode === "agent" ? "agent" : requestedMode === "all" ? "all" : "normal";
    const sessions = await db.query.chatSessions.findMany({
        where: mode === "all"
            ? eq(chatSessions.userId, userId)
            : and(eq(chatSessions.userId, userId), eq(chatSessions.mode, mode)),
        orderBy: [desc(chatSessions.updatedAt)],
        columns: { id: true, title: true, createdAt: true, updatedAt: true, projectId: true, mode: true, externalSessionId: true }
    });

    return Response.json(sessions);
}
