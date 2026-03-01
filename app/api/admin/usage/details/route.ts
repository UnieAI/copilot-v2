import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { tokenUsage, users, groups } from "@/lib/db/schema";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";

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
    const limitParam = Number(url.searchParams.get("limit") || 200);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : 200;

    const parsedEnd = endParam ? new Date(endParam) : null;
    const parsedStart = startParam ? new Date(startParam) : null;

    const endDate = (!parsedEnd || Number.isNaN(parsedEnd.getTime())) ? new Date() : parsedEnd;
    endDate.setHours(23, 59, 59, 999);

    const defaultStart = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = (!parsedStart || Number.isNaN(parsedStart.getTime())) ? defaultStart : parsedStart;
    startDate.setHours(0, 0, 0, 0);
    if (startDate > endDate) startDate.setTime(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const rows = await db
        .select({
            id: tokenUsage.id,
            userId: tokenUsage.userId,
            groupId: tokenUsage.groupId,
            model: tokenUsage.model,
            providerPrefix: tokenUsage.providerPrefix,
            totalTokens: tokenUsage.totalTokens,
            createdAt: tokenUsage.createdAt,
        })
        .from(tokenUsage)
        .where(and(gte(tokenUsage.createdAt, startDate), lte(tokenUsage.createdAt, endDate)))
        .orderBy(sql`${tokenUsage.createdAt} desc`)
        .limit(limit);

    const userIds = Array.from(new Set(rows.map(r => r.userId).filter(Boolean)));
    const groupIds = Array.from(new Set(rows.map(r => r.groupId).filter(Boolean))) as string[];

    const [userList, groupList] = await Promise.all([
        userIds.length > 0 ? db.query.users.findMany({ where: inArray(users.id, userIds), columns: { id: true, name: true, email: true } }) : [],
        groupIds.length > 0 ? db.query.groups.findMany({ where: inArray(groups.id, groupIds), columns: { id: true, name: true } }) : [],
    ]);

    const userMap = new Map(userList.map(u => [u.id, u]));
    const groupMap = new Map(groupList.map(g => [g.id, g]));

    const result = rows.map(r => ({
        id: r.id,
        model: r.model,
        providerPrefix: r.providerPrefix,
        totalTokens: Number(r.totalTokens || 0),
        createdAt: r.createdAt,
        user: userMap.get(r.userId) || { id: r.userId },
        group: r.groupId ? (groupMap.get(r.groupId) || { id: r.groupId }) : null,
        source: r.groupId ? "group" : "personal",
    }));

    return Response.json({
        range: { start: startDate.toISOString(), end: endDate.toISOString() },
        items: result,
    });
}
