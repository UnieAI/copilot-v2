import { db } from "@/lib/db";
import { groupTokenUsage, tokenUsage, users } from "@/lib/db/schema";
import { requireGroupEditor } from "@/lib/group-permissions";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";

// GET /api/admin/groups/[id]/usage — aggregated token usage per user
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: groupId } = await params;
    if (!(await requireGroupEditor(groupId))) return new Response("Forbidden", { status: 403 });

    const url = new URL(req.url || "");
    const startParam = url.searchParams.get("start");
    const endParam = url.searchParams.get("end");

    const parsedEnd = endParam ? new Date(endParam) : null;
    const parsedStart = startParam ? new Date(startParam) : null;

    const endDate = (!parsedEnd || Number.isNaN(parsedEnd.getTime())) ? new Date() : parsedEnd;
    endDate.setHours(23, 59, 59, 999);

    const defaultStart = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = (!parsedStart || Number.isNaN(parsedStart.getTime())) ? defaultStart : parsedStart;
    startDate.setHours(0, 0, 0, 0);

    // Ensure start is not after end
    if (startDate > endDate) {
        startDate.setTime(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const whereClauses = [
        eq(tokenUsage.groupId, groupId),
        gte(tokenUsage.createdAt, startDate),
        lte(tokenUsage.createdAt, endDate),
    ];

    const baseSelect = {
        userId: tokenUsage.userId,
        promptTokens: sql<number>`coalesce(sum(${tokenUsage.promptTokens}), 0)`,
        completionTokens: sql<number>`coalesce(sum(${tokenUsage.completionTokens}), 0)`,
        totalTokens: sql<number>`coalesce(sum(${tokenUsage.totalTokens}), 0)`,
    };

    const usage = await db
        .select(baseSelect)
        .from(tokenUsage)
        .where(and(...whereClauses))
        .groupBy(tokenUsage.userId);

    // Include legacy rows if any
    const legacyUsage = await db
        .select({
            userId: groupTokenUsage.userId,
            promptTokens: sql<number>`coalesce(sum(${groupTokenUsage.promptTokens}), 0)`,
            completionTokens: sql<number>`coalesce(sum(${groupTokenUsage.completionTokens}), 0)`,
            totalTokens: sql<number>`coalesce(sum(${groupTokenUsage.totalTokens}), 0)`,
        })
        .from(groupTokenUsage)
        .where(and(eq(groupTokenUsage.groupId, groupId), gte(groupTokenUsage.createdAt, startDate), lte(groupTokenUsage.createdAt, endDate)))
        .groupBy(groupTokenUsage.userId);

    const perModel = await db
        .select({
            userId: tokenUsage.userId,
            model: tokenUsage.model,
            promptTokens: sql<number>`coalesce(sum(${tokenUsage.promptTokens}), 0)`,
            completionTokens: sql<number>`coalesce(sum(${tokenUsage.completionTokens}), 0)`,
            totalTokens: sql<number>`coalesce(sum(${tokenUsage.totalTokens}), 0)`,
        })
        .from(tokenUsage)
        .where(and(...whereClauses))
        .groupBy(tokenUsage.userId, tokenUsage.model);

    const dayExpr = sql`date_trunc('day', ${tokenUsage.createdAt})`;
    const timeseries = await db
        .select({
            day: sql<string>`(${dayExpr})::date`,
            promptTokens: sql<number>`coalesce(sum(${tokenUsage.promptTokens}), 0)`,
            completionTokens: sql<number>`coalesce(sum(${tokenUsage.completionTokens}), 0)`,
            totalTokens: sql<number>`coalesce(sum(${tokenUsage.totalTokens}), 0)`,
        })
        .from(tokenUsage)
        .where(and(...whereClauses))
        .groupBy(dayExpr)
        .orderBy(dayExpr);

    const allUserIds = new Set<string>();
    usage.forEach(u => allUserIds.add(u.userId));
    legacyUsage.forEach(u => allUserIds.add(u.userId));
    perModel.forEach(u => allUserIds.add(u.userId));
    const userIds = [...allUserIds].filter(Boolean);
    const userList = userIds.length > 0
        ? await db.query.users.findMany({
            where: inArray(users.id, userIds),
            columns: { id: true, name: true, email: true, image: true },
        })
        : [];
    const userMap = new Map(userList.map((u) => [u.id, u]));

    // Merge legacy usage into usage totals (so older rows still counted)
    const usageMap = new Map<string, { promptTokens: number; completionTokens: number; totalTokens: number }>();
    for (const row of usage) {
        usageMap.set(row.userId, {
            promptTokens: Number(row.promptTokens || 0),
            completionTokens: Number(row.completionTokens || 0),
            totalTokens: Number(row.totalTokens || 0),
        });
    }
    for (const row of legacyUsage) {
        const prev = usageMap.get(row.userId) || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        usageMap.set(row.userId, {
            promptTokens: prev.promptTokens + Number(row.promptTokens || 0),
            completionTokens: prev.completionTokens + Number(row.completionTokens || 0),
            totalTokens: prev.totalTokens + Number(row.totalTokens || 0),
        });
    }

    const result = {
        perUser: Array.from(usageMap.entries()).map(([userId, val]) => ({
            user: userMap.get(userId) || { id: userId },
            promptTokens: val.promptTokens,
            completionTokens: val.completionTokens,
            totalTokens: val.totalTokens,
        })),
        timeseries: timeseries.map((row) => ({
            date: String(row.day),
            promptTokens: Number(row.promptTokens || 0),
            completionTokens: Number(row.completionTokens || 0),
            totalTokens: Number(row.totalTokens || 0),
        })),
        perUserModel: perModel.map((m) => ({
            user: userMap.get(m.userId) || { id: m.userId },
            model: m.model || "unknown",
            promptTokens: Number(m.promptTokens || 0),
            completionTokens: Number(m.completionTokens || 0),
            totalTokens: Number(m.totalTokens || 0),
        })),
        range: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
        },
    };

    return Response.json(result);
}
