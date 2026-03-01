import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { users, userGroups } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireGroupEditor, requireGroupMember } from "@/lib/group-permissions";

type MemberInput = { userId: string; role: string };

// GET /api/admin/groups/[id]/members — list members with user details
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!(await requireGroupMember(id))) return new Response("Forbidden", { status: 403 });

    const memberships = await db.query.userGroups.findMany({
        where: eq(userGroups.groupId, id),
    });

    if (memberships.length === 0) return Response.json([]);

    const memberUsers = await db.query.users.findMany({
        where: inArray(users.id, memberships.map((m) => m.userId)),
        columns: { id: true, name: true, email: true, role: true, image: true },
    });

    const userMap = new Map(memberUsers.map((u) => [u.id, u]));
    const merged = memberships.map((m) => ({
        ...(userMap.get(m.userId) || { id: m.userId }),
        membershipRole: m.role,
    }));

    return Response.json(merged);
}

// PUT /api/admin/groups/[id]/members — replace member list { members: { userId, role }[] }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: groupId } = await params;
    if (!(await requireGroupEditor(groupId))) return new Response("Forbidden", { status: 403 });

    const body = await req.json() as { members: MemberInput[] };
    const members = Array.isArray(body?.members) ? body.members : [];

    if (members.length === 0) {
        return Response.json({ error: "至少需要一位成員" }, { status: 400 });
    }

    const normalized = members.map((m) => ({
        userId: m.userId,
        role: ["creator", "editor", "member"].includes(m.role) ? m.role : "member",
    }));
    const uniqueNormalized = Array.from(new Map(normalized.map((m) => [m.userId, m])).values());

    const hasCreator = uniqueNormalized.some(m => m.role === "creator");
    if (!hasCreator) return Response.json({ error: "至少需要一位 Creator" }, { status: 400 });

    // Replace all memberships in a transaction
    await db.transaction(async (tx) => {
        await tx.delete(userGroups).where(eq(userGroups.groupId, groupId));
        await tx.insert(userGroups).values(
            uniqueNormalized.map((m) => ({
                userId: m.userId,
                groupId,
                role: m.role || "member",
            }))
        );
    });

    return new Response(null, { status: 204 });
}
