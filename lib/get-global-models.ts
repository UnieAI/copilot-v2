import { db } from "@/lib/db";
import { globalProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getGlobalModels() {
  const providers = await db.query.globalProviders.findMany({
    where: eq(globalProviders.enable, 1),
  });

  const results: {
    value: string;
    label: string;
    providerName: string;
    providerPrefix: string;
    source: "global";
  }[] = [];

  for (const p of providers) {
    const selectedIds = Array.isArray(p.selectedModels) ? (p.selectedModels as string[]) : [];
    if (selectedIds.length === 0) continue;

    const allModels = Array.isArray(p.modelList) ? (p.modelList as any[]) : [];
    const modelsToExpose = allModels.filter((m: any) => selectedIds.includes(m.id || String(m)));

    for (const m of modelsToExpose) {
      results.push({
        value: `${p.prefix}-${m.id || String(m)}`,
        label: m.id || String(m),
        providerName: p.displayName || p.prefix,
        providerPrefix: p.prefix,
        source: "global",
      });
    }
  }

  return results;
}

