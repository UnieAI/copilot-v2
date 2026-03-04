import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { globalProviderRoleModelQuotas, globalProviders, tokenUsage, userPhotos, users } from "@/lib/db/schema";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getQuotaWindow } from "@/lib/quota-window";

function requireAdmin(role?: string | null) {
  return role === "admin" || role === "super";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!session?.user || !requireAdmin(role)) return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  const search = req.nextUrl.searchParams;
  const targetRole = search.get("role");
  const targetModel = search.get("model");

  if (!targetRole || !targetModel) {
    return Response.json({ error: "role and model are required" }, { status: 400 });
  }
  if (!["user", "admin", "super"].includes(targetRole)) {
    return Response.json({ error: "invalid role" }, { status: 400 });
  }

  const provider = await db.query.globalProviders.findFirst({
    where: eq(globalProviders.id, id),
  });
  if (!provider) return new Response("Not found", { status: 404 });

  const quota = await db.query.globalProviderRoleModelQuotas.findFirst({
    where: and(
      eq(globalProviderRoleModelQuotas.providerId, id),
      eq(globalProviderRoleModelQuotas.role, targetRole),
      eq(globalProviderRoleModelQuotas.model, targetModel)
    ),
  });

  const refillIntervalHours = Math.max(1, Number(quota?.refillIntervalHours || 12));
  const limitTokens = quota
    ? (quota.limitTokens === null ? null : Number(quota.limitTokens))
    : null;
  const window = getQuotaWindow(new Date(), refillIntervalHours);

  const roleUsers = await db
    .select({
      id: users.id,
      name: users.name,
      image: userPhotos.image,
      email: users.email,
    })
    .from(users)
    .leftJoin(userPhotos, eq(userPhotos.userId, users.id))
    .where(eq(users.role, targetRole));

  if (roleUsers.length === 0) {
    return Response.json({
      role: targetRole,
      model: targetModel,
      limitTokens,
      refreshAt: window.end.toISOString(),
      items: [],
    });
  }

  const userIds = roleUsers.map((u) => u.id);
  const usageRows = await db
    .select({
      userId: tokenUsage.userId,
      total: sql<number>`coalesce(sum(${tokenUsage.totalTokens}),0)`,
    })
    .from(tokenUsage)
    .where(and(
      inArray(tokenUsage.userId, userIds),
      eq(tokenUsage.providerPrefix, provider.prefix),
      eq(tokenUsage.model, targetModel),
      gte(tokenUsage.createdAt, window.start)
    ))
    .groupBy(tokenUsage.userId);

  const usageByUserId = new Map<string, number>(
    usageRows.map((row) => [row.userId, Number(row.total || 0)])
  );

  const items = roleUsers.map((u) => {
    const usedTokens = usageByUserId.get(u.id) || 0;
    const remainingTokens = limitTokens === null ? null : Math.max(limitTokens - usedTokens, 0);
    return {
      userId: u.id,
      name: u.name || u.email || "Unknown User",
      image: u.image || null,
      usedTokens,
      remainingTokens,
      refreshAt: window.end.toISOString(),
    };
  });

  return Response.json({
    role: targetRole,
    model: targetModel,
    limitTokens,
    refreshAt: window.end.toISOString(),
    items,
  });
}
