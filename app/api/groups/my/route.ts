import { auth } from "@/auth";
import { db } from "@/lib/db";
import { groups, userGroups, groupProviders } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

// GET /api/groups/my — list groups the current user belongs to
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
    const userId = session.user.id as string;

    const memberships = await db.query.userGroups.findMany({
        where: eq(userGroups.userId, userId),
    });

    if (memberships.length === 0) return Response.json([]);

    const membershipMap = new Map(memberships.map(m => [m.groupId, m.role]));

    const targetGroups = await db.query.groups.findMany({
        where: (g, { inArray }) => inArray(g.id, memberships.map(m => m.groupId)),
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
