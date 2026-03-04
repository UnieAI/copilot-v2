import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { groups, userGroups, groupProviders } from "@/lib/db/schema";
import { inArray, eq, sql } from "drizzle-orm";
import { isAdminSession } from "@/lib/group-permissions";

// GET /api/admin/groups — list groups visible to the requester with counts
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return new Response("Forbidden", { status: 403 });
    const userId = session.user.id as string;
    const isAdmin = isAdminSession(session);

    const memberships = await db.query.userGroups.findMany({
        where: eq(userGroups.userId, userId),
    });
    const membershipMap = new Map(memberships.map(m => [m.groupId, m.role]));

    const targetGroups = isAdmin
        ? await db.query.groups.findMany({ orderBy: (g, { asc }) => [asc(g.createdAt)] })
        : memberships.length === 0
            ? []
            : await db.query.groups.findMany({
                where: inArray(groups.id, memberships.map(m => m.groupId)),
                orderBy: (g, { asc }) => [asc(g.createdAt)],
            });

    const result = await Promise.all(
        targetGroups.map(async (g) => {
            const [memberCount] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(userGroups)
                .where(eq(userGroups.groupId, g.id));
            const [providerCount] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(groupProviders)
                .where(eq(groupProviders.groupId, g.id));
            return {
                ...g,
                memberCount: memberCount?.count ?? 0,
                providerCount: providerCount?.count ?? 0,
                currentUserRole: membershipMap.get(g.id) || null,
            };
        })
    );

    return Response.json(result);
}

// POST /api/admin/groups — create a group (admin/super only)
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Forbidden", { status: 403 });
    if (!isAdminSession(session)) return new Response("Forbidden", { status: 403 });
    const userId = session.user.id as string;

    const { name, image, extraMembers } = await req.json();
    if (!name?.trim()) return Response.json({ error: "name is required" }, { status: 400 });

    const [group] = await db.insert(groups).values({
        name: name.trim(),
        image: image || null,
        creatorId: userId,
    }).returning();

    // Ensure creator is also a member with creator role
    await db.insert(userGroups).values({
        userId,
        groupId: group.id,
        role: "creator",
    }).onConflictDoNothing();

    // Add extra members from the create dialog
    if (Array.isArray(extraMembers) && extraMembers.length > 0) {
        const toInsert = extraMembers
            .filter((m: any) => m.userId && m.userId !== userId)
            .map((m: any) => ({ userId: m.userId, groupId: group.id, role: m.role || "member" as const }));
        if (toInsert.length > 0) {
            await db.insert(userGroups).values(toInsert).onConflictDoNothing();
        }
    }

    return Response.json(group, { status: 201 });
}
