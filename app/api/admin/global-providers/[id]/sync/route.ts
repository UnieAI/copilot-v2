import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { globalProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function requireAdmin(role?: string | null) {
  return role === "admin" || role === "super";
}

export async function POST(
  req: NextRequest,
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

  const body = await req.json().catch(() => ({}));
  const inputApiUrl = typeof body?.apiUrl === "string" ? body.apiUrl.trim() : "";
  const inputApiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";

  const apiUrl = inputApiUrl || provider.apiUrl;
  const apiKey = inputApiKey || provider.apiKey;
  if (!apiUrl || !apiKey) {
    return Response.json({ error: "apiUrl and apiKey are required" }, { status: 400 });
  }

  const cleanUrl = apiUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
  const targetUrl = `${cleanUrl}/v1/models`;

  try {
    const res = await fetch(targetUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      return Response.json({ error: `API returned ${res.status}: ${res.statusText}` }, { status: 502 });
    }

    const data = await res.json();
    const models = Array.isArray(data?.data) ? data.data : [];
    const modelIds = models.map((m: any) => m.id || String(m));

    const existingSelected = Array.isArray(provider.selectedModels)
      ? (provider.selectedModels as string[])
      : [];
    const selectedStillExists = existingSelected.filter((modelId) => modelIds.includes(modelId));
    const selectedModels = selectedStillExists.length > 0 ? selectedStillExists : modelIds;

    const [updated] = await db
      .update(globalProviders)
      .set({
        modelList: models as any,
        selectedModels: selectedModels as any,
        updatedAt: new Date(),
      })
      .where(eq(globalProviders.id, id))
      .returning();

    return Response.json({ modelList: models, selectedModels, provider: updated });
  } catch (e: any) {
    return Response.json({ error: `Connection failed: ${e.message}` }, { status: 502 });
  }
}

