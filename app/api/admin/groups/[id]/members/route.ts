import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { groups, userGroups, userPhotos, users } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireGroupEditor, requireGroupMember } from "@/lib/group-permissions";

type MemberInput = { userId: string; role: string };

// GET /api/admin/groups/[id]/members - list members with user details
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!(await requireGroupMember(id))) return new Response("Forbidden", { status: 403 });

    const memberships = await db.query.userGroups.findMany({
        where: eq(userGroups.groupId, id),
    });

    if (memberships.length === 0) return Response.json([]);

    const memberUsers = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            image: userPhotos.image,
        })
        .from(users)
        .leftJoin(userPhotos, eq(userPhotos.userId, users.id))
        .where(inArray(users.id, memberships.map((m) => m.userId)));

    const userMap = new Map(memberUsers.map((u) => [u.id, u]));
    const merged = memberships.map((m) => ({
        ...(userMap.get(m.userId) || { id: m.userId }),
        membershipRole: m.role,
    }));

    return Response.json(merged);
}

// PUT /api/admin/groups/[id]/members - replace member list { members: { userId, role }[] }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: groupId } = await params;
    if (!(await requireGroupEditor(groupId))) return new Response("Forbidden", { status: 403 });

    const group = await db.query.groups.findFirst({
        where: eq(groups.id, groupId),
        columns: { id: true, creatorId: true },
    });
    if (!group) return new Response("Not Found", { status: 404 });

    const existingCreatorMembership = await db.query.userGroups.findFirst({
        where: and(eq(userGroups.groupId, groupId), eq(userGroups.role, "creator")),
        columns: { userId: true },
    });
    const creatorUserId = group.creatorId || existingCreatorMembership?.userId || null;
    if (!creatorUserId) {
        return Response.json({ error: "group creator not found" }, { status: 400 });
    }

    const body = await req.json() as { members: MemberInput[] };
    const members = Array.isArray(body?.members) ? body.members : [];

    if (members.length === 0) {
        return Response.json({ error: "at least one member is required" }, { status: 400 });
    }

    const normalized = members.map((m) => ({
        userId: m.userId,
        role: ["creator", "editor", "member"].includes(m.role) ? m.role : "member",
    }));
    const uniqueNormalized = Array.from(new Map(normalized.map((m) => [m.userId, m])).values());

    const creatorMembership = uniqueNormalized.find((m) => m.userId === creatorUserId);
    if (!creatorMembership) {
        return Response.json({ error: "group creator must remain a member" }, { status: 400 });
    }
    if (creatorMembership.role !== "creator") {
        return Response.json({ error: "group creator role cannot be changed" }, { status: 400 });
    }
    const otherCreator = uniqueNormalized.some((m) => m.role === "creator" && m.userId !== creatorUserId);
    if (otherCreator) {
        return Response.json({ error: "only the group creator can have creator role" }, { status: 400 });
    }

    // Replace all memberships in a transaction
    await db.transaction(async (tx) => {
        await tx.delete(userGroups).where(eq(userGroups.groupId, groupId));
        await tx.insert(userGroups).values(
            uniqueNormalized.map((m) => ({
                userId: m.userId,
                groupId,
                role: m.userId === creatorUserId ? "creator" : (m.role === "editor" ? "editor" : "member"),
            }))
        );
    });

    return new Response(null, { status: 204 });
}
