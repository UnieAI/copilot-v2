import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { getProvidersWithKeysForUser } from "@/lib/agent/providers"

export const runtime = "nodejs"

/**
 * Returns providers/models available to the current user for agent mode.
 * This endpoint does not patch OpenCode config.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const providers = await getProvidersWithKeysForUser(session.user.id as string)
    const responseProviders = providers.map((p) => ({
      id: p.id,
      name: p.providerName,
      models: p.models.map((m) => ({ id: m.id, name: m.name })),
    }))

    const defaults = responseProviders.reduce<Record<string, string>>((acc, provider) => {
      const first = provider.models[0]
      if (first?.id) acc[provider.id] = first.id
      return acc
    }, {})

    return NextResponse.json({ providers: responseProviders, default: defaults })
  } catch (e: any) {
    console.error("[agent/providers/sync] Error:", e)
    return NextResponse.json(
      { error: "Failed to load providers", details: e?.message || "Unknown error" },
      { status: 500 },
    )
  }
}
