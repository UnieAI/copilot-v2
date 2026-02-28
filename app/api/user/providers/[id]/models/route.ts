import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { userProviders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// DELETE /api/user/providers/[id]/models — remove a model from a provider's modelList
// Body: { modelId: string }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const userId = session.user.id as string;
    const { id } = await params;
    const body = await req.json();
    const { modelId } = body;

    if (!modelId) return Response.json({ error: "modelId is required" }, { status: 400 });

    const provider = await db.query.userProviders.findFirst({
        where: and(eq(userProviders.id, id), eq(userProviders.userId, userId)),
    });

    if (!provider) return new Response("Not found", { status: 404 });

    const currentModels = Array.isArray(provider.modelList) ? (provider.modelList as any[]) : [];
    const updatedModels = currentModels.filter((m: any) => (m.id || String(m)) !== modelId);

    const [updated] = await db.update(userProviders)
        .set({ modelList: updatedModels as any, updatedAt: new Date() })
        .where(and(eq(userProviders.id, id), eq(userProviders.userId, userId)))
        .returning();

    return Response.json({ modelList: updatedModels, provider: updated });
}
