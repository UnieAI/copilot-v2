import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { groupUserQuotas, groupUserModelQuotas, groupModelQuotas, tokenUsage } from "@/lib/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { requireGroupEditor } from "@/lib/group-permissions";
import { getQuotaWindow, sanitizeRefillIntervalHours } from "@/lib/quota-window";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;
  if (!(await requireGroupEditor(groupId))) return new Response("Forbidden", { status: 403 });

  const [userQuotas, modelQuotas, groupModel] = await Promise.all([
    db.query.groupUserQuotas.findMany({ where: eq(groupUserQuotas.groupId, groupId) }),
    db.query.groupUserModelQuotas.findMany({ where: eq(groupUserModelQuotas.groupId, groupId) }),
    db.query.groupModelQuotas.findMany({ where: eq(groupModelQuotas.groupId, groupId) }),
  ]);

  const now = new Date();

  const userQuotaItems = await Promise.all(
    userQuotas.map(async (q) => {
      const window = getQuotaWindow(now, q.refillIntervalHours);
      const [used] = await db
        .select({ total: sql<number>`coalesce(sum(${tokenUsage.totalTokens}),0)` })
        .from(tokenUsage)
        .where(and(
          eq(tokenUsage.groupId, groupId),
          eq(tokenUsage.userId, q.userId),
          gte(tokenUsage.createdAt, window.start)
        ));
      const usedTokens = Number(used?.total || 0);
      const limitTokens = q.limitTokens === null ? null : Number(q.limitTokens);
      return {
        userId: q.userId,
        limitTokens,
        refillIntervalHours: q.refillIntervalHours,
        usedTokens,
        remainingTokens: limitTokens === null ? null : Math.max(limitTokens - usedTokens, 0),
        refreshAt: window.end.toISOString(),
      };
    })
  );

  const modelQuotaItems = await Promise.all(
    modelQuotas.map(async (q) => {
      const window = getQuotaWindow(now, q.refillIntervalHours);
      const [used] = await db
        .select({ total: sql<number>`coalesce(sum(${tokenUsage.totalTokens}),0)` })
        .from(tokenUsage)
        .where(and(
          eq(tokenUsage.groupId, groupId),
          eq(tokenUsage.userId, q.userId),
          eq(tokenUsage.model, q.model),
          gte(tokenUsage.createdAt, window.start)
        ));
      const usedTokens = Number(used?.total || 0);
      const limitTokens = q.limitTokens === null ? null : Number(q.limitTokens);
      return {
        userId: q.userId,
        model: q.model,
        limitTokens,
        refillIntervalHours: q.refillIntervalHours,
        usedTokens,
        remainingTokens: limitTokens === null ? null : Math.max(limitTokens - usedTokens, 0),
        refreshAt: window.end.toISOString(),
      };
    })
  );

  const groupModelItems = await Promise.all(
    groupModel.map(async (q) => {
      const window = getQuotaWindow(now, q.refillIntervalHours);
      const [used] = await db
        .select({ total: sql<number>`coalesce(sum(${tokenUsage.totalTokens}),0)` })
        .from(tokenUsage)
        .where(and(
          eq(tokenUsage.groupId, groupId),
          eq(tokenUsage.model, q.model),
          gte(tokenUsage.createdAt, window.start)
        ));
      const usedTokens = Number(used?.total || 0);
      const limitTokens = q.limitTokens === null ? null : Number(q.limitTokens);
      return {
        model: q.model,
        limitTokens,
        refillIntervalHours: q.refillIntervalHours,
        usedTokens,
        remainingTokens: limitTokens === null ? null : Math.max(limitTokens - usedTokens, 0),
        refreshAt: window.end.toISOString(),
      };
    })
  );

  return Response.json({
    userQuotas: userQuotaItems,
    modelQuotas: modelQuotaItems,
    groupModelQuotas: groupModelItems,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;
  if (!(await requireGroupEditor(groupId))) return new Response("Forbidden", { status: 403 });

  const body = await req.json() as {
    userQuotas?: { userId: string; limitTokens: number | null; refillIntervalHours?: number }[];
    modelQuotas?: { userId: string; model: string; limitTokens: number | null; refillIntervalHours?: number }[];
    groupModelQuotas?: { model: string; limitTokens: number | null; refillIntervalHours?: number }[];
  };

  const userQuotas = Array.isArray(body.userQuotas) ? body.userQuotas : [];
  const modelQuotas = Array.isArray(body.modelQuotas) ? body.modelQuotas : [];
  const groupModel = Array.isArray(body.groupModelQuotas) ? body.groupModelQuotas : [];

  await db.transaction(async (tx) => {
    await tx.delete(groupUserQuotas).where(eq(groupUserQuotas.groupId, groupId));
    if (userQuotas.length > 0) {
      await tx.insert(groupUserQuotas).values(
        userQuotas.map(q => ({
          groupId,
          userId: q.userId,
          limitTokens: q.limitTokens === null ? null : Number(q.limitTokens),
          refillIntervalHours: sanitizeRefillIntervalHours(q.refillIntervalHours, 12),
          updatedAt: new Date(),
        }))
      );
    }

    await tx.delete(groupUserModelQuotas).where(eq(groupUserModelQuotas.groupId, groupId));
    if (modelQuotas.length > 0) {
      await tx.insert(groupUserModelQuotas).values(
        modelQuotas.map(q => ({
          groupId,
          userId: q.userId,
          model: q.model,
          limitTokens: q.limitTokens === null ? null : Number(q.limitTokens),
          refillIntervalHours: sanitizeRefillIntervalHours(q.refillIntervalHours, 12),
          updatedAt: new Date(),
        }))
      );
    }

    await tx.delete(groupModelQuotas).where(eq(groupModelQuotas.groupId, groupId));
    if (groupModel.length > 0) {
      await tx.insert(groupModelQuotas).values(
        groupModel.map(q => ({
          groupId,
          model: q.model,
          limitTokens: q.limitTokens === null ? null : Number(q.limitTokens),
          refillIntervalHours: sanitizeRefillIntervalHours(q.refillIntervalHours, 12),
          updatedAt: new Date(),
        }))
      );
    }
  });

  return new Response(null, { status: 204 });
}

