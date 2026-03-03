import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { globalProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function requireAdmin(role?: string | null) {
  return role === "admin" || role === "super";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!session?.user || !requireAdmin(role)) return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { displayName, apiUrl, apiKey, enable, modelList, selectedModels } = body;

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (displayName !== undefined) updates.displayName = displayName;
  if (apiUrl !== undefined) updates.apiUrl = apiUrl;
  if (apiKey !== undefined) updates.apiKey = apiKey;
  if (enable !== undefined) updates.enable = enable ? 1 : 0;
  if (modelList !== undefined) updates.modelList = modelList;
  if (selectedModels !== undefined) updates.selectedModels = selectedModels;

  const [updated] = await db
    .update(globalProviders)
    .set(updates)
    .where(eq(globalProviders.id, id))
    .returning();

  if (!updated) return new Response("Not found", { status: 404 });
  return Response.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!session?.user || !requireAdmin(role)) return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  await db.delete(globalProviders).where(eq(globalProviders.id, id));
  return new Response(null, { status: 204 });
}
