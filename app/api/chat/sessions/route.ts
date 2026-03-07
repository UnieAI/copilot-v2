import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { chatSessions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const userId = session.user.id as string;
    const mode = req.nextUrl.searchParams.get("mode") || "all";

    const where =
        mode === "normal"
            ? and(eq(chatSessions.userId, userId), eq(chatSessions.mode, "normal"))
            : mode === "agent"
                ? and(eq(chatSessions.userId, userId), eq(chatSessions.mode, "agent"))
                : eq(chatSessions.userId, userId);

    const sessions = await db.query.chatSessions.findMany({
        where,
        orderBy: [desc(chatSessions.updatedAt)],
        columns: {
            id: true,
            title: true,
            createdAt: true,
            updatedAt: true,
            projectId: true,
            mode: true,
            externalSessionId: true,
        }
    });

    return Response.json(sessions);
}
