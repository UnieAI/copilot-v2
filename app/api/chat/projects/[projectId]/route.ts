import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { chatProjects, chatSessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/** PATCH /api/chat/projects/[projectId] — rename folder */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
    const userId = session.user.id as string;
    const { projectId } = await params;

    const project = await db.query.chatProjects.findFirst({
        where: and(eq(chatProjects.id, projectId), eq(chatProjects.userId, userId))
    });
    if (!project) return new Response("Not found", { status: 404 });

    const body = await req.json().catch(() => ({}));
    if (typeof body.name === 'string' && body.name.trim()) {
        await db.update(chatProjects)
            .set({ name: body.name.trim(), updatedAt: new Date() })
            .where(eq(chatProjects.id, projectId));
    }

    return Response.json({ success: true });
}

/** DELETE /api/chat/projects/[projectId] — delete folder (sessions become unassigned) */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
    const userId = session.user.id as string;
    const { projectId } = await params;

    const project = await db.query.chatProjects.findFirst({
        where: and(eq(chatProjects.id, projectId), eq(chatProjects.userId, userId))
    });
    if (!project) return new Response("Not found", { status: 404 });

    // Delete all chat sessions belonging to this project (cascade)
    await db.delete(chatSessions).where(and(eq(chatSessions.projectId, projectId), eq(chatSessions.userId, userId)));

    // Then delete the project itself
    await db.delete(chatProjects).where(eq(chatProjects.id, projectId));
    return Response.json({ success: true });
}
