import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { groups, userGroups } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

// DELETE /api/groups/[id]/leave — let a group member leave the group.
// The group creator cannot leave (they must delete the group instead).
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: groupId } = await params;
    const session = await auth();
    if (!session?.user?.id) return new Response("Forbidden", { status: 403 });
    const userId = session.user.id as string;

    // Check membership exists
    const membership = await db.query.userGroups.findFirst({
        where: and(eq(userGroups.userId, userId), eq(userGroups.groupId, groupId)),
    });
    if (!membership) return new Response("Not a member", { status: 404 });

    // Creator cannot leave
    if (membership.role === "creator") {
        return Response.json(
            { error: "群組建立者無法退出，請刪除群組或轉移建立者身份" },
            { status: 403 }
        );
    }

    // Check group exists
    const group = await db.query.groups.findFirst({
        where: eq(groups.id, groupId),
        columns: { id: true },
    });
    if (!group) return new Response("Not Found", { status: 404 });

    await db
        .delete(userGroups)
        .where(and(eq(userGroups.userId, userId), eq(userGroups.groupId, groupId)));

    return new Response(null, { status: 204 });
}
