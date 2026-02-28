import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { groupProviders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

async function requireAdmin() {
    const session = await auth();
    const role = (session?.user as any)?.role as string;
    if (!session?.user || !["admin", "super"].includes(role)) return null;
    return session;
}

// POST /api/admin/groups/[id]/providers/[pid]/sync
export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; pid: string }> }
) {
    if (!(await requireAdmin())) return new Response("Forbidden", { status: 403 });
    const { id: groupId, pid } = await params;

    const provider = await db.query.groupProviders.findFirst({
        where: and(eq(groupProviders.id, pid), eq(groupProviders.groupId, groupId)),
    });

    if (!provider) return new Response("Not found", { status: 404 });

    const cleanUrl = provider.apiUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
    const targetUrl = `${cleanUrl}/v1/models`;

    try {
        const res = await fetch(targetUrl, {
            headers: { Authorization: `Bearer ${provider.apiKey}` },
        });

        if (!res.ok) {
            return Response.json(
                { error: `API returned ${res.status}: ${res.statusText}` },
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
        return Response.json({ error: `Connection failed: ${e.message}` }, { status: 502 });
    }
}
