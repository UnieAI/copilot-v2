import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { userProviders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// POST /api/user/providers/[id]/sync — fetch /v1/models from provider and update modelList
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const userId = session.user.id as string;
    const { id } = await params;

    const provider = await db.query.userProviders.findFirst({
        where: and(eq(userProviders.id, id), eq(userProviders.userId, userId)),
    });

    if (!provider) return new Response("Not found", { status: 404 });

    const body = await req.json().catch(() => ({}));
    const inputApiUrl = typeof body?.apiUrl === "string" ? body.apiUrl.trim() : "";
    const inputApiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";

    const apiUrl = inputApiUrl || provider.apiUrl;
    const apiKey = inputApiKey || provider.apiKey;
    if (!apiUrl || !apiKey) {
        return Response.json({ error: "apiUrl and apiKey are required" }, { status: 400 });
    }

    const cleanUrl = apiUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
    const targetUrl = `${cleanUrl}/v1/models`;

    try {
        const res = await fetch(targetUrl, {
            headers: { "Authorization": `Bearer ${apiKey}` },
        });

        if (!res.ok) {
            return Response.json({ error: `API returned ${res.status}: ${res.statusText}` }, { status: 502 });
        }

        const data = await res.json();
        const models = Array.isArray(data?.data) ? data.data : [];
        const modelIds = models.map((m: any) => m.id || String(m));
        const existingSelected = Array.isArray((provider as any).selectedModels)
            ? ((provider as any).selectedModels as string[])
            : [];
        const selectedStillExists = existingSelected.filter((modelId) => modelIds.includes(modelId));
        const selectedModels = selectedStillExists.length > 0 ? selectedStillExists : modelIds;

        const [updated] = await db.update(userProviders)
            .set({
                apiUrl,
                apiKey,
                modelList: models as any,
                selectedModels: selectedModels as any,
                updatedAt: new Date(),
            })
            .where(and(eq(userProviders.id, id), eq(userProviders.userId, userId)))
            .returning();

        return Response.json({ modelList: models, selectedModels, provider: updated });
    } catch (e: any) {
        return Response.json({ error: `Connection failed: ${e.message}` }, { status: 502 });
    }
}
