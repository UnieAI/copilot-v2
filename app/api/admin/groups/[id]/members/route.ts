import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, userGroups } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

async function requireAdmin() {
    const session = await auth();
    const role = (session?.user as any)?.role as string;
    if (!session?.user || !["admin", "super"].includes(role)) return null;
    return session;
}

// GET /api/admin/groups/[id]/members — list members with user details
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await requireAdmin())) return new Response("Forbidden", { status: 403 });
    const { id } = await params;

    const memberships = await db.query.userGroups.findMany({
        where: eq(userGroups.groupId, id),
    });

    if (memberships.length === 0) return Response.json([]);

    const memberUsers = await db.query.users.findMany({
        where: inArray(users.id, memberships.map((m) => m.userId)),
        columns: { id: true, name: true, email: true, role: true, image: true },
    });

    return Response.json(memberUsers);
}

// PUT /api/admin/groups/[id]/members — replace member list { userIds: string[] }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await requireAdmin())) return new Response("Forbidden", { status: 403 });
    const { id: groupId } = await params;
    const { userIds } = await req.json() as { userIds: string[] };

    // Replace all memberships in a transaction
    await db.transaction(async (tx) => {
        await tx.delete(userGroups).where(eq(userGroups.groupId, groupId));
        if (userIds && userIds.length > 0) {
            await tx.insert(userGroups).values(
                userIds.map((userId) => ({ userId, groupId }))
            );
        }
    });

    return new Response(null, { status: 204 });
}
