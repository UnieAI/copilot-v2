import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { userProviders, groupProviders, globalProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/user/providers — list all providers for current user
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const userId = session.user.id as string;
    const providers = await db.query.userProviders.findMany({
        where: eq(userProviders.userId, userId),
        orderBy: (p, { asc }) => [asc(p.updatedAt)],
    });

    return Response.json(providers);
}

// POST /api/user/providers — create a new provider
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const userId = session.user.id as string;
    const body = await req.json();
    const { displayName, prefix, apiUrl, apiKey, enable } = body;

    if (!prefix || !/^[a-zA-Z0-9]{4}$/.test(prefix)) {
        return Response.json({ error: "Prefix must be exactly 4 alphanumeric characters" }, { status: 400 });
    }
    if (!apiUrl || !apiKey) {
        return Response.json({ error: "apiUrl and apiKey are required" }, { status: 400 });
    }

    const upperPrefix = prefix.toUpperCase();

    // Check prefix uniqueness globally (all user providers + all group providers)
    const [existingUserProvider, existingGroupProvider, existingGlobalProvider] = await Promise.all([
        db.query.userProviders.findFirst({
            where: eq(userProviders.prefix, upperPrefix),
        }),
        db.query.groupProviders.findFirst({
            where: eq(groupProviders.prefix, upperPrefix),
        }),
        db.query.globalProviders.findFirst({
            where: eq(globalProviders.prefix, upperPrefix),
        }),
    ]);

    if (existingUserProvider || existingGroupProvider || existingGlobalProvider) {
        return Response.json({ error: "Prefix already in use" }, { status: 409 });
    }

    const [created] = await db.insert(userProviders).values({
        userId,
        displayName: displayName || '',
        prefix: upperPrefix,
        apiUrl,
        apiKey,
        enable: enable === false ? 0 : 1,
        modelList: [] as any,
        selectedModels: [] as any,
    }).returning();

    try {
        const cleanUrl = String(apiUrl).replace(/\/+$/, "").replace(/\/v1$/, "");
        const res = await fetch(`${cleanUrl}/v1/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
            const data = await res.json();
            const models = Array.isArray(data?.data) ? data.data : [];
            const selectedModels = models.map((m: any) => m.id || String(m));
            const [updated] = await db
                .update(userProviders)
                .set({ modelList: models as any, selectedModels: selectedModels as any, updatedAt: new Date() })
                .where(eq(userProviders.id, created.id))
                .returning();
            return Response.json(updated, { status: 201 });
        }
    } catch {
        // Keep created row even if sync failed.
    }

    return Response.json(created, { status: 201 });
}
