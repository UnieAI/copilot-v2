import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { groupProviders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireGroupEditor } from "@/lib/group-permissions";

// POST /api/admin/groups/[id]/providers/[pid]/sync
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; pid: string }> }
) {
    const { id: groupId, pid } = await params;
    if (!(await requireGroupEditor(groupId))) return new Response("Forbidden", { status: 403 });

    const provider = await db.query.groupProviders.findFirst({
        where: and(eq(groupProviders.id, pid), eq(groupProviders.groupId, groupId)),
    });

    if (!provider) return new Response("Not found", { status: 404 });

    const body = await req.json().catch(() => ({}));
    const inputApiUrl = typeof body?.apiUrl === "string" ? body.apiUrl.trim() : "";
    const inputApiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    const apiUrl = inputApiUrl || provider.apiUrl;
    const apiKey = inputApiKey || provider.apiKey;
    const clearModels = async () => {
        const [cleared] = await db
            .update(groupProviders)
            .set({
                modelList: [] as any,
                selectedModels: [] as any,
                updatedAt: new Date(),
            })
            .where(and(eq(groupProviders.id, pid), eq(groupProviders.groupId, groupId)))
            .returning();
        return cleared;
    };

    if (!apiUrl || !apiKey) {
        const cleared = await clearModels();
        return Response.json(
            {
                error: "apiUrl and apiKey are required",
                modelList: [],
                selectedModels: [],
                provider: cleared,
            },
            { status: 400 }
        );
    }

    const cleanUrl = apiUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
    const targetUrl = `${cleanUrl}/v1/models`;

    try {
        const res = await fetch(targetUrl, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!res.ok) {
            const cleared = await clearModels();
            return Response.json(
                {
                    error: `API returned ${res.status}: ${res.statusText}`,
                    modelList: [],
                    selectedModels: [],
                    provider: cleared,
                },
                { status: 502 }
            );
        }

        const data = await res.json();
        const models = Array.isArray(data?.data) ? data.data : [];

        // Preserve existing selectedModels; if empty initially, default to all model IDs
        const existingSelected = Array.isArray(provider.selectedModels)
            ? (provider.selectedModels as string[])
            : [];

        const [updated] = await db
            .update(groupProviders)
            .set({
                modelList: models as any,
                // Keep selectedModels as-is (admin manages selection separately)
                updatedAt: new Date(),
            })
            .where(and(eq(groupProviders.id, pid), eq(groupProviders.groupId, groupId)))
            .returning();

        return Response.json({ modelList: models, selectedModels: existingSelected, provider: updated });
    } catch (e: any) {
        const cleared = await clearModels();
        return Response.json(
            {
                error: `Connection failed: ${e.message}`,
                modelList: [],
                selectedModels: [],
                provider: cleared,
            },
            { status: 502 }
        );
    }
}
