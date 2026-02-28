import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { groups, userGroups, groupProviders } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

async function requireAdmin() {
    const session = await auth();
    const role = (session?.user as any)?.role as string;
    if (!session?.user || !["admin", "super"].includes(role)) return null;
    return session;
}

// GET /api/admin/groups — list all groups with member count and provider count
export async function GET() {
    if (!(await requireAdmin())) return new Response("Forbidden", { status: 403 });

    const allGroups = await db.query.groups.findMany({
        orderBy: (g, { asc }) => [asc(g.createdAt)],
    });

    // Attach member & provider counts
    const result = await Promise.all(
        allGroups.map(async (g) => {
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
            };
        })
    );

    return Response.json(result);
}

// POST /api/admin/groups — create a group
export async function POST(req: NextRequest) {
    if (!(await requireAdmin())) return new Response("Forbidden", { status: 403 });

    const { name } = await req.json();
    if (!name?.trim()) return Response.json({ error: "name is required" }, { status: 400 });

    const [group] = await db.insert(groups).values({ name: name.trim() }).returning();
    return Response.json(group, { status: 201 });
}
