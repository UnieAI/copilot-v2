import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { userProviders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

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

    // Check prefix uniqueness for this user
    const existing = await db.query.userProviders.findFirst({
        where: and(eq(userProviders.userId, userId), eq(userProviders.prefix, prefix.toUpperCase())),
    });
    if (existing) {
        return Response.json({ error: "Prefix already in use" }, { status: 409 });
    }

    const [newProvider] = await db.insert(userProviders).values({
        userId,
        displayName: displayName || '',
        prefix: prefix.toUpperCase(),
        apiUrl,
        apiKey,
        enable: enable === false ? 0 : 1,
        modelList: [] as any,
    }).returning();

    return Response.json(newProvider, { status: 201 });
}
