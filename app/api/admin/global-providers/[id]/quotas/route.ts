import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { globalProviderRoleModelQuotas, globalProviders, tokenUsage, users } from "@/lib/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { getQuotaWindow, sanitizeRefillIntervalHours } from "@/lib/quota-window";

function requireAdmin(role?: string | null) {
  return role === "admin" || role === "super";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!session?.user || !requireAdmin(role)) return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  const provider = await db.query.globalProviders.findFirst({
    where: eq(globalProviders.id, id),
  });
  if (!provider) return new Response("Not found", { status: 404 });

  const quotas = await db.query.globalProviderRoleModelQuotas.findMany({
    where: eq(globalProviderRoleModelQuotas.providerId, id),
  });

  const now = new Date();
  const items = await Promise.all(
    quotas.map(async (q) => {
      const window = getQuotaWindow(now, q.refillIntervalHours);
      const [used] = await db
        .select({ total: sql<number>`coalesce(sum(${tokenUsage.totalTokens}),0)` })
        .from(tokenUsage)
        .leftJoin(users, eq(tokenUsage.userId, users.id))
        .where(and(
          eq(tokenUsage.providerPrefix, provider.prefix),
          eq(tokenUsage.model, q.model),
          eq(users.role, q.role),
          gte(tokenUsage.createdAt, window.start)
        ));

      const usedTokens = Number(used?.total || 0);
      const limitTokens = q.limitTokens === null ? null : Number(q.limitTokens);
      const remainingTokens = limitTokens === null ? null : Math.max(limitTokens - usedTokens, 0);

      return {
        providerId: q.providerId,
        role: q.role,
        model: q.model,
        limitTokens,
        refillIntervalHours: q.refillIntervalHours,
        usedTokens,
        remainingTokens,
        refreshAt: window.end.toISOString(),
      };
    })
  );

  return Response.json({ quotas: items });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!session?.user || !requireAdmin(role)) return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const quotas = Array.isArray(body?.quotas) ? body.quotas : [];

  await db.transaction(async (tx) => {
    await tx.delete(globalProviderRoleModelQuotas).where(eq(globalProviderRoleModelQuotas.providerId, id));
    if (quotas.length > 0) {
      await tx.insert(globalProviderRoleModelQuotas).values(
        quotas
          .filter((q: any) => ["user", "admin", "super"].includes(String(q?.role)) && q?.model)
          .map((q: any) => ({
            providerId: id,
            role: String(q.role),
            model: String(q.model),
            limitTokens: q.limitTokens === null ? null : Number(q.limitTokens),
            refillIntervalHours: sanitizeRefillIntervalHours(q.refillIntervalHours, 12),
            updatedAt: new Date(),
          }))
      );
    }
  });

  return new Response(null, { status: 204 });
}

