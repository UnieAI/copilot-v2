import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { getProvidersWithKeysForUser } from "@/lib/available-models"
import { opencodeFetch } from "@/lib/opencode/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id as string

  try {
    const rawProviders = await getProvidersWithKeysForUser(userId)
    if (rawProviders.length === 0) {
      return NextResponse.json({ success: true, message: "No custom providers to clear" })
    }

    const providerIds = rawProviders.map((p) => p.id)

    // 1. DELETE /auth/{provider} for each provider to remove credentials
    await Promise.allSettled(
      providerIds.map((id) =>
        opencodeFetch(`/auth/${id}`, { method: "DELETE" })
      )
    )

    // 2. PATCH /global/config to add providers to disabled_providers
    let currentDisabled: string[] = []
    try {
      const cfgRes = await opencodeFetch("/global/config")
      if (cfgRes.ok) {
        const cfg = (await cfgRes.json()) as { disabled_providers?: string[] }
        currentDisabled = cfg.disabled_providers || []
      }
    } catch { /* proceed with empty */ }

    const nextDisabled = [...new Set([...currentDisabled, ...providerIds])]

    await opencodeFetch("/global/config", {
      method: "PATCH",
      body: { disabled_providers: nextDisabled },
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("[agent-clear-models] Error clearing providers:", e)
    return NextResponse.json(
      { error: "Failed to clear available models", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}
