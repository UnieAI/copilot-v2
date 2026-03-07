import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { getProvidersWithKeysForUser } from "@/lib/agent/providers"

export const runtime = "nodejs"

/**
 * GET: Returns available models grouped by provider for the agent model picker.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const rawProviders = await getProvidersWithKeysForUser(session.user.id as string)

    const providers = rawProviders.map((p) => ({
      id: p.id,
      name: p.providerName,
      models: p.models.map((m) => ({ id: m.id, name: m.name })),
    }))

    const defaults = providers.reduce<Record<string, string>>((acc, provider) => {
      const first = provider.models[0]
      if (first?.id) acc[provider.id] = first.id
      return acc
    }, {})

    return NextResponse.json({ providers, default: defaults })
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to resolve available models", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}
