import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { groupProviders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireGroupEditor } from "@/lib/group-permissions";

function toModelIds(models: unknown[]): string[] {
    const ids = models
        .map((model: any) => {
            if (typeof model === "string") return model;
            if (typeof model?.id === "string") return model.id;
            if (model?.id !== undefined && model?.id !== null) return String(model.id);
            return "";
        })
        .filter(Boolean);

    return Array.from(new Set(ids));
}

function hasSameModelIds(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const bSet = new Set(b);
    return a.every((id) => bSet.has(id));
}

// PATCH /api/admin/groups/[id]/providers/[pid]
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; pid: string }> }
) {
    const { id: groupId, pid } = await params;
    if (!(await requireGroupEditor(groupId))) return new Response("Forbidden", { status: 403 });

    const body = await req.json();
    const { displayName, apiUrl, apiKey, enable, modelList, selectedModels } = body;
    const provider = await db.query.groupProviders.findFirst({
        where: and(eq(groupProviders.id, pid), eq(groupProviders.groupId, groupId)),
    });

    if (!provider) return new Response("Not Found", { status: 404 });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (displayName !== undefined) updates.displayName = displayName;
    if (apiUrl !== undefined) updates.apiUrl = apiUrl;
    if (apiKey !== undefined) updates.apiKey = apiKey;
    if (enable !== undefined) updates.enable = enable ? 1 : 0;
    if (modelList !== undefined) updates.modelList = modelList;
    if (selectedModels !== undefined) updates.selectedModels = selectedModels;

    const isProviderConfigEdit =
        displayName !== undefined ||
        apiUrl !== undefined ||
        apiKey !== undefined ||
        enable !== undefined;

    const hasManualModelUpdates = modelList !== undefined || selectedModels !== undefined;

    // When editing provider settings, immediately re-fetch models with latest credentials.
    // If sync fails, clear modelList/selectedModels.
    // If sync succeeds, only update modelList/selectedModels when model IDs differ.
    if (isProviderConfigEdit && !hasManualModelUpdates) {
        const resolvedApiUrl = typeof apiUrl === "string" ? apiUrl.trim() : provider.apiUrl;
        const resolvedApiKey = typeof apiKey === "string" ? apiKey.trim() : provider.apiKey;
        let shouldClearModels = false;

        if (resolvedApiUrl && resolvedApiKey) {
            const cleanUrl = resolvedApiUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
            const targetUrl = `${cleanUrl}/v1/models`;

            try {
                const res = await fetch(targetUrl, {
                    headers: { Authorization: `Bearer ${resolvedApiKey}` },
                });

                if (!res.ok) {
                    shouldClearModels = true;
                } else {
                    const data = await res.json();
                    const fetchedModels = Array.isArray(data?.data) ? data.data : [];
                    const fetchedModelIds = toModelIds(fetchedModels);
                    const existingModelList = Array.isArray(provider.modelList) ? provider.modelList : [];
                    const existingModelIds = toModelIds(existingModelList);

                    if (!hasSameModelIds(fetchedModelIds, existingModelIds)) {
                        updates.modelList = fetchedModels;

                        const existingSelected = Array.isArray(provider.selectedModels)
                            ? (provider.selectedModels as string[])
                            : [];
                        const fetchedSet = new Set(fetchedModelIds);
                        updates.selectedModels = existingSelected.filter((id) => fetchedSet.has(id));
                    }
                }
            } catch {
                shouldClearModels = true;
            }
        } else {
            shouldClearModels = true;
        }

        if (shouldClearModels) {
            updates.modelList = [];
            updates.selectedModels = [];
        }
    }

    const [updated] = await db
        .update(groupProviders)
        .set(updates as any)
        .where(and(eq(groupProviders.id, pid), eq(groupProviders.groupId, groupId)))
        .returning();

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
