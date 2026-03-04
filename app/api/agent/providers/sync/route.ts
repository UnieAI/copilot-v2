import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { getProvidersWithKeysForUser } from "@/lib/available-models"

/**
 * Returns DB providers for the agent model picker.
 * No opencode PATCH here — model sync happens lazily via /ensure when the user selects a model.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id as string

  try {
    const rawProviders = await getProvidersWithKeysForUser(userId)

    const providers = rawProviders.map(p => ({
      id: p.id,
      name: p.providerName,
      models: [...p.models]
    }))
    const defaults = providers.reduce<Record<string, string>>((acc, provider) => {
      const first = provider.models[0]
      if (first?.id) acc[provider.id] = first.id
      return acc
    }, {})

    return NextResponse.json({ providers, default: defaults })
  } catch (e: any) {
    console.error("[agent-sync-models] Error:", e)
    return NextResponse.json(
      { error: "Failed to list available models", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}
