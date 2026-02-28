import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { groupProviders, userProviders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

async function requireAdmin() {
    const session = await auth();
    const role = (session?.user as any)?.role as string;
    if (!session?.user || !["admin", "super"].includes(role)) return null;
    return session;
}

// GET /api/admin/groups/[id]/providers
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await requireAdmin())) return new Response("Forbidden", { status: 403 });
    const { id } = await params;

    const providers = await db.query.groupProviders.findMany({
        where: eq(groupProviders.groupId, id),
        orderBy: (p, { asc }) => [asc(p.updatedAt)],
    });

    return Response.json(providers);
}

// POST /api/admin/groups/[id]/providers
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await requireAdmin())) return new Response("Forbidden", { status: 403 });
    const { id: groupId } = await params;
    const body = await req.json();
    const { displayName, prefix, apiUrl, apiKey, enable } = body;

    if (!prefix || !/^[a-zA-Z0-9]{4}$/.test(prefix)) {
        return Response.json({ error: "Prefix must be exactly 4 alphanumeric characters" }, { status: 400 });
    }
    if (!apiUrl || !apiKey) {
        return Response.json({ error: "apiUrl and apiKey are required" }, { status: 400 });
    }

    const upperPrefix = prefix.toUpperCase();

    // Check prefix uniqueness within this group
    const existingInGroup = await db.query.groupProviders.findFirst({
        where: and(eq(groupProviders.groupId, groupId), eq(groupProviders.prefix, upperPrefix)),
    });
    if (existingInGroup) {
        return Response.json({ error: "此 Prefix 在群組中已被使用" }, { status: 409 });
    }

    // Check prefix uniqueness: must not conflict with ANY user_providers prefix (global)
    const existingInUsers = await db.query.userProviders.findFirst({
        where: eq(userProviders.prefix, upperPrefix),
    });
    if (existingInUsers) {
        return Response.json({ error: "此 Prefix 已被某位用戶使用，請換一個" }, { status: 409 });
    }

    // Check prefix uniqueness: must not conflict with ANY other group's provider prefix
    const existingInAnyGroup = await db.query.groupProviders.findFirst({
        where: eq(groupProviders.prefix, upperPrefix),
    });
    if (existingInAnyGroup) {
        return Response.json({ error: "此 Prefix 已被另一個群組使用，請換一個" }, { status: 409 });
    }

    // Create the provider
    const [newProvider] = await db
        .insert(groupProviders)
        .values({
            groupId,
            displayName: displayName || "",
            prefix: upperPrefix,
            apiUrl,
            apiKey,
            enable: enable === false ? 0 : 1,
            modelList: [] as any,
            selectedModels: [] as any,
        })
        .returning();

    // Auto-sync: fetch models from the API
    try {
        const cleanUrl = apiUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
        const res = await fetch(`${cleanUrl}/v1/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
            const data = await res.json();
            const models = Array.isArray(data?.data) ? data.data : [];
            const [updated] = await db
                .update(groupProviders)
                .set({ modelList: models as any, updatedAt: new Date() })
                .where(eq(groupProviders.id, newProvider.id))
                .returning();
            return Response.json(updated, { status: 201 });
        }
    } catch {
        // Auto-sync failed silently — provider is still created
    }

    return Response.json(newProvider, { status: 201 });
}
