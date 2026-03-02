import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { globalProviders, groupProviders, userProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function requireAdmin(role?: string | null) {
  return role === "admin" || role === "super";
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!session?.user || !requireAdmin(role)) return new Response("Forbidden", { status: 403 });

  const providers = await db.query.globalProviders.findMany({
    orderBy: (p, { asc }) => [asc(p.updatedAt)],
  });
  return Response.json(providers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!session?.user || !requireAdmin(role)) return new Response("Forbidden", { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { displayName, prefix, apiUrl, apiKey, enable } = body;

  if (!prefix || !/^[a-zA-Z0-9]{4}$/.test(prefix)) {
    return Response.json({ error: "Prefix must be exactly 4 alphanumeric characters" }, { status: 400 });
  }
  if (!apiUrl || !apiKey) {
    return Response.json({ error: "apiUrl and apiKey are required" }, { status: 400 });
  }

  const upperPrefix = String(prefix).toUpperCase();
  const [userConflict, groupConflict, globalConflict] = await Promise.all([
    db.query.userProviders.findFirst({ where: eq(userProviders.prefix, upperPrefix) }),
    db.query.groupProviders.findFirst({ where: eq(groupProviders.prefix, upperPrefix) }),
    db.query.globalProviders.findFirst({ where: eq(globalProviders.prefix, upperPrefix) }),
  ]);
  if (userConflict || groupConflict || globalConflict) {
    return Response.json({ error: "Prefix already in use" }, { status: 409 });
  }

  const [created] = await db.insert(globalProviders).values({
    displayName: displayName || "",
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
        .update(globalProviders)
        .set({ modelList: models as any, selectedModels: selectedModels as any, updatedAt: new Date() })
        .where(eq(globalProviders.id, created.id))
        .returning();
      return Response.json(updated, { status: 201 });
    }
  } catch {
    // Keep created row even if sync failed.
  }

  return Response.json(created, { status: 201 });
}

