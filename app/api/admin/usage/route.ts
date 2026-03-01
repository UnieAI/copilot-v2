import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { tokenUsage, groups } from "@/lib/db/schema";
import { sql, gte, lte, and, inArray } from "drizzle-orm";

function requireAdminRole(role?: string | null) {
    return role && (role === "admin" || role === "super");
}

export async function GET(req: NextRequest) {
    const session = await auth();
    const role = (session?.user as any)?.role as string;
    if (!session?.user || !requireAdminRole(role)) return new Response("Forbidden", { status: 403 });

    const url = new URL(req.url);
    const startParam = url.searchParams.get("start");
    const endParam = url.searchParams.get("end");

    const parsedEnd = endParam ? new Date(endParam) : null;
    const parsedStart = startParam ? new Date(startParam) : null;

    const endDate = (!parsedEnd || Number.isNaN(parsedEnd.getTime())) ? new Date() : parsedEnd;
    endDate.setHours(23, 59, 59, 999);

    const defaultStart = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = (!parsedStart || Number.isNaN(parsedStart.getTime())) ? defaultStart : parsedStart;
    startDate.setHours(0, 0, 0, 0);

    if (startDate > endDate) startDate.setTime(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dayExpr = sql`date_trunc('day', ${tokenUsage.createdAt})`;
    const timeseries = await db
        .select({
            day: sql<string>`(${dayExpr})::date`,
            totalTokens: sql<number>`coalesce(sum(${tokenUsage.totalTokens}),0)`,
            personalTokens: sql<number>`coalesce(sum(${tokenUsage.totalTokens}) FILTER (WHERE ${tokenUsage.groupId} IS NULL),0)`,
            groupTokens: sql<number>`coalesce(sum(${tokenUsage.totalTokens}) FILTER (WHERE ${tokenUsage.groupId} IS NOT NULL),0)`,
        })
        .from(tokenUsage)
        .where(and(gte(tokenUsage.createdAt, startDate), lte(tokenUsage.createdAt, endDate)))
        .groupBy(dayExpr)
        .orderBy(dayExpr);

    const perGroup = await db
        .select({
            groupId: tokenUsage.groupId,
            totalTokens: sql<number>`coalesce(sum(${tokenUsage.totalTokens}),0)`,
        })
        .from(tokenUsage)
        .where(and(
            gte(tokenUsage.createdAt, startDate),
            lte(tokenUsage.createdAt, endDate),
            sql`${tokenUsage.groupId} IS NOT NULL`
        ))
        .groupBy(tokenUsage.groupId);

    const groupIds = perGroup.map(g => g.groupId).filter(Boolean) as string[];
    const groupList = groupIds.length > 0
        ? await db.query.groups.findMany({ where: inArray(groups.id, groupIds) })
        : [];
    const groupMap = new Map(groupList.map(g => [g.id, g.name]));

    const totalsRow = await db
        .select({
            totalTokens: sql<number>`coalesce(sum(${tokenUsage.totalTokens}),0)`,
            personalTokens: sql<number>`coalesce(sum(${tokenUsage.totalTokens}) FILTER (WHERE ${tokenUsage.groupId} IS NULL),0)`,
            groupTokens: sql<number>`coalesce(sum(${tokenUsage.totalTokens}) FILTER (WHERE ${tokenUsage.groupId} IS NOT NULL),0)`,
        })
        .from(tokenUsage)
        .where(and(gte(tokenUsage.createdAt, startDate), lte(tokenUsage.createdAt, endDate)));

    const totals = totalsRow?.[0] || { totalTokens: 0, personalTokens: 0, groupTokens: 0 };

    return Response.json({
        range: { start: startDate.toISOString(), end: endDate.toISOString() },
        totals: {
            totalTokens: Number(totals.totalTokens || 0),
            personalTokens: Number(totals.personalTokens || 0),
            groupTokens: Number(totals.groupTokens || 0),
        },
        timeseries: timeseries.map(t => ({
            date: String(t.day),
            totalTokens: Number(t.totalTokens || 0),
            personalTokens: Number(t.personalTokens || 0),
            groupTokens: Number(t.groupTokens || 0),
        })),
        perGroup: perGroup.map(g => ({
            groupId: g.groupId,
            groupName: (g.groupId && groupMap.get(g.groupId)) || "未命名群組",
            totalTokens: Number(g.totalTokens || 0),
        })),
    });
}
