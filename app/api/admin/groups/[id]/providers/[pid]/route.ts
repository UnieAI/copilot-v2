import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { groupProviders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireGroupEditor } from "@/lib/group-permissions";

// PATCH /api/admin/groups/[id]/providers/[pid]
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; pid: string }> }
) {
    const { id: groupId, pid } = await params;
    if (!(await requireGroupEditor(groupId))) return new Response("Forbidden", { status: 403 });

    const body = await req.json();
    const { displayName, apiUrl, apiKey, enable, modelList, selectedModels } = body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (displayName !== undefined) updates.displayName = displayName;
    if (apiUrl !== undefined) updates.apiUrl = apiUrl;
    if (apiKey !== undefined) updates.apiKey = apiKey;
    if (enable !== undefined) updates.enable = enable ? 1 : 0;
    if (modelList !== undefined) updates.modelList = modelList;
    if (selectedModels !== undefined) updates.selectedModels = selectedModels;

    const [updated] = await db
        .update(groupProviders)
        .set(updates as any)
        .where(and(eq(groupProviders.id, pid), eq(groupProviders.groupId, groupId)))
        .returning();

    if (!updated) return new Response("Not Found", { status: 404 });
    return Response.json(updated);
}

// DELETE /api/admin/groups/[id]/providers/[pid]
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; pid: string }> }
) {
    const { id: groupId, pid } = await params;
    if (!(await requireGroupEditor(groupId))) return new Response("Forbidden", { status: 403 });

    await db
        .delete(groupProviders)
        .where(and(eq(groupProviders.id, pid), eq(groupProviders.groupId, groupId)));
    return new Response(null, { status: 204 });
}
