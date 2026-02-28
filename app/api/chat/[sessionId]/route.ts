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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const { sessionId } = await params;
    const userId = session.user.id as string;

    const chatSession = await db.query.chatSessions.findFirst({
        where: and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId))
    });
    if (!chatSession) return new Response("Not found", { status: 404 });

    const body = await req.json();

    const updates: Record<string, any> = { updatedAt: new Date() };

    // Rename title
    if (typeof body.title === 'string' && body.title.trim()) {
        updates.title = body.title.trim();
    }

    // Move to/from project folder (null = remove from folder)
    if ('projectId' in body) {
        updates.projectId = body.projectId ?? null;
    }

    await db.update(chatSessions).set(updates).where(eq(chatSessions.id, sessionId));
    return Response.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const { sessionId } = await params;
    const userId = session.user.id as string;

    const chatSession = await db.query.chatSessions.findFirst({
        where: and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId))
    });
    if (!chatSession) return new Response("Not found", { status: 404 });

    await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
    return Response.json({ success: true });
}
