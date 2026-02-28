import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const { sessionId } = await params;
    const userId = session.user.id as string;

    const msgs = await db.query.chatMessages.findMany({
        where: and(eq(chatMessages.sessionId, sessionId), eq(chatMessages.userId, userId)),
        orderBy: (m, { asc }) => [asc(m.createdAt)]
    });

    return Response.json(msgs);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const { sessionId } = await params;
    const userId = session.user.id as string;

    // Verify ownership
    const chatSession = await db.query.chatSessions.findFirst({
        where: and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId))
    });
    if (!chatSession) return new Response("Not found", { status: 404 });

    await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
    return Response.json({ success: true });
}
