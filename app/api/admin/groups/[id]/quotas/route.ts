import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { groupUserQuotas, groupUserModelQuotas, groupModelQuotas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireGroupEditor } from "@/lib/group-permissions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: groupId } = await params;
    if (!(await requireGroupEditor(groupId))) return new Response("Forbidden", { status: 403 });

    const [userQuotas, modelQuotas, groupModel] = await Promise.all([
        db.query.groupUserQuotas.findMany({ where: eq(groupUserQuotas.groupId, groupId) }),
        db.query.groupUserModelQuotas.findMany({ where: eq(groupUserModelQuotas.groupId, groupId) }),
        db.query.groupModelQuotas.findMany({ where: eq(groupModelQuotas.groupId, groupId) }),
    ]);

    return Response.json({ userQuotas, modelQuotas, groupModelQuotas: groupModel });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: groupId } = await params;
    if (!(await requireGroupEditor(groupId))) return new Response("Forbidden", { status: 403 });

    const body = await req.json() as {
        userQuotas?: { userId: string; limitTokens: number | null }[];
        modelQuotas?: { userId: string; model: string; limitTokens: number | null }[];
        groupModelQuotas?: { model: string; limitTokens: number | null }[];
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
                    updatedAt: new Date(),
                }))
            );
        }
    });

    return new Response(null, { status: 204 });
}
