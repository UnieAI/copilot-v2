import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function requireAdmin() {
    const session = await auth();
    const role = (session?.user as any)?.role as string;
    if (!session?.user || !["admin", "super"].includes(role)) return null;
    return session;
}

// PATCH /api/admin/groups/[id] — rename group
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await requireAdmin())) return new Response("Forbidden", { status: 403 });
    const { id } = await params;
    const { name } = await req.json();
    if (!name?.trim()) return Response.json({ error: "name is required" }, { status: 400 });

    const [updated] = await db
        .update(groups)
        .set({ name: name.trim(), updatedAt: new Date() })
        .where(eq(groups.id, id))
        .returning();

    if (!updated) return new Response("Not Found", { status: 404 });
    return Response.json(updated);
}

// DELETE /api/admin/groups/[id] — delete group (cascades providers + memberships)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await requireAdmin())) return new Response("Forbidden", { status: 403 });
    const { id } = await params;
    await db.delete(groups).where(eq(groups.id, id));
    return new Response(null, { status: 204 });
}
