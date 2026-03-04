import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireGroupCreator, requireGroupEditor } from "@/lib/group-permissions";

// PATCH /api/admin/groups/[id] — update group (name, image)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!(await requireGroupEditor(id))) return new Response("Forbidden", { status: 403 });

    const { name, image } = await req.json();
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) {
        if (!name?.trim()) return Response.json({ error: "name is required" }, { status: 400 });
        updateData.name = name.trim();
    }
    if (image !== undefined) {
        updateData.image = image || null;
    }

    const [updated] = await db
        .update(groups)
        .set(updateData)
        .where(eq(groups.id, id))
        .returning();

    if (!updated) return new Response("Not Found", { status: 404 });
    return Response.json(updated);
}

// DELETE /api/admin/groups/[id] — delete group (cascades providers + memberships)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!(await requireGroupCreator(id))) return new Response("Forbidden", { status: 403 });
    await db.delete(groups).where(eq(groups.id, id));
    return new Response(null, { status: 204 });
}
