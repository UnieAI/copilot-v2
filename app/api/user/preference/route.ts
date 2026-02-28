import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/user/preference — get current user's selected model preference
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const userId = session.user.id as string;
    const pref = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
    });

    return Response.json(pref || { selectedModel: null, selectedProviderPrefix: null });
}

// PUT /api/user/preference — save model preference
export async function PUT(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const userId = session.user.id as string;
    const body = await req.json();
    const { selectedModel, selectedProviderPrefix } = body;

    const existing = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
    });

    if (existing) {
        await db.update(userPreferences)
            .set({ selectedModel, selectedProviderPrefix, updatedAt: new Date() })
            .where(eq(userPreferences.userId, userId));
    } else {
        await db.insert(userPreferences).values({
            userId,
            selectedModel,
            selectedProviderPrefix,
        });
    }

    return Response.json({ ok: true });
}
