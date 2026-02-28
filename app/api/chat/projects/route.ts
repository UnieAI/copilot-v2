import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { chatProjects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/** GET /api/chat/projects — list user's folders */
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
    const userId = session.user.id as string;

    const projects = await db.query.chatProjects.findMany({
        where: eq(chatProjects.userId, userId),
        orderBy: (p, { desc }) => [desc(p.updatedAt)],
    });

    return Response.json(projects);
}

/** POST /api/chat/projects — create a new folder */
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
    const userId = session.user.id as string;

    const body = await req.json().catch(() => ({}));
    const name = (body.name as string)?.trim() || '新資料夾';

    const [project] = await db.insert(chatProjects).values({ userId, name }).returning();
    return Response.json(project);
}
