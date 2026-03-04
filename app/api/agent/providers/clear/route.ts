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

    const providerConfig: Record<string, any> = {}
    const providerIds = rawProviders.map(p => p.id)

    for (const id of providerIds) {
      // Clear out the API key to prevent reuse by opencode background processes
      providerConfig[id] = {
        options: {
          apiKey: "",
        },
      }
    }

    // Call OpenCode /config endpoint using PATCH to remove these credentials
    const ocRes = await opencodeFetch("/config", {
      method: "PATCH",
      body: {
        provider: providerConfig,
      },
    })

    if (!ocRes.ok) {
      console.error("[agent-clear-models] OpenCode config patch failed", await ocRes.text())
      return NextResponse.json({ error: "Failed to clear provider config from OpenCode" }, { status: ocRes.status })
    }

    // Also disable these providers in OpenCode
    const ocConfigRes = await opencodeFetch("/config")
    if (ocConfigRes.ok) {
      const ocConfigList = (await ocConfigRes.json()) as { disabled_providers?: string[] }
      const currentDisabled = ocConfigList.disabled_providers || []
      
      const nextDisabled = [...new Set([...currentDisabled, ...providerIds])]
      
      if (nextDisabled.length !== currentDisabled.length) {
          await opencodeFetch("/config", {
              method: "PATCH",
              body: {
                  disabled_providers: nextDisabled
              }
          })
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("[agent-clear-models] Error clearing providers:", e)
    return NextResponse.json(
      { error: "Failed to clear available models", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}
