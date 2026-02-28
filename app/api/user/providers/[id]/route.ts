import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { userProviders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// PATCH /api/user/providers/[id] — update a provider
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const userId = session.user.id as string;
    const { id } = await params;
    const body = await req.json();
    const { displayName, prefix, apiUrl, apiKey, enable, modelList } = body;

    // Validate prefix if provided
    if (prefix !== undefined && !/^[a-zA-Z0-9]{4}$/.test(prefix)) {
        return Response.json({ error: "Prefix must be exactly 4 alphanumeric characters" }, { status: 400 });
    }

    // Check prefix uniqueness (exclude current provider)
    if (prefix !== undefined) {
        const conflict = await db.query.userProviders.findFirst({
            where: and(eq(userProviders.userId, userId), eq(userProviders.prefix, prefix.toUpperCase())),
        });
        if (conflict && conflict.id !== id) {
            return Response.json({ error: "Prefix already in use" }, { status: 409 });
        }
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (displayName !== undefined) updateData.displayName = displayName;
    if (prefix !== undefined) updateData.prefix = prefix.toUpperCase();
    if (apiUrl !== undefined) updateData.apiUrl = apiUrl;
    if (apiKey !== undefined) updateData.apiKey = apiKey;
    if (enable !== undefined) updateData.enable = enable ? 1 : 0;
    if (modelList !== undefined) updateData.modelList = modelList;

    const [updated] = await db.update(userProviders)
        .set(updateData)
        .where(and(eq(userProviders.id, id), eq(userProviders.userId, userId)))
        .returning();

    if (!updated) return new Response("Not found", { status: 404 });
    return Response.json(updated);
}

// DELETE /api/user/providers/[id] — delete a provider
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const userId = session.user.id as string;
    const { id } = await params;

    await db.delete(userProviders)
        .where(and(eq(userProviders.id, id), eq(userProviders.userId, userId)));

    return new Response(null, { status: 204 });
}
