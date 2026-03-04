import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { getProvidersWithKeysForUser } from "@/lib/available-models"
import { opencodeFetch } from "@/lib/opencode/server"

/**
 * Lazily ensure a single model's provider exists in OpenCode.
 * Called when the user selects a model in agent mode.
 *
 * Uses PATCH /global/config which can create arbitrary provider keys
 * (unlike /config which only accepts registry-known providers).
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id as string

  let body: { providerPrefix?: string; modelID?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { providerPrefix, modelID } = body
  if (!providerPrefix || !modelID) {
    return NextResponse.json({ error: "providerPrefix and modelID are required" }, { status: 400 })
  }

  try {
    const allProviders = await getProvidersWithKeysForUser(userId)
    const provider = allProviders.find((p) => p.id === providerPrefix)
    if (!provider) {
      return NextResponse.json(
        { error: `Provider ${providerPrefix} not found for user` },
        { status: 404 }
      )
    }

    const model = provider.models.find((m) => m.id === modelID)
    if (!model) {
      return NextResponse.json(
        { error: `Model ${modelID} not found in provider ${providerPrefix}` },
        { status: 404 }
      )
    }

    // PATCH /global/config — creates provider if needed, adds model
    const patchBody = {
      provider: {
        [providerPrefix]: {
          name: provider.providerName,
          npm: "@ai-sdk/openai-compatible",
          options: {
            baseURL: provider.apiUrl,
            apiKey: provider.apiKey,
          },
          models: {
            [modelID]: { name: model.name },
          },
        },
      },
      disabled_providers: [] as string[],
    }

    // Read current config to preserve disabled_providers (minus our provider)
    try {
      const cfgRes = await opencodeFetch("/global/config")
      if (cfgRes.ok) {
        const cfg = (await cfgRes.json()) as { disabled_providers?: string[] }
        const current = cfg.disabled_providers || []
        patchBody.disabled_providers = current.filter((id) => id !== providerPrefix)
      }
    } catch { /* use empty array */ }

    const ocRes = await opencodeFetch("/global/config", {
      method: "PATCH",
      body: patchBody,
    })

    if (!ocRes.ok) {
      const errText = await ocRes.text()
      console.error("[agent-ensure] OpenCode PATCH failed:", ocRes.status, errText)
      return NextResponse.json(
        { error: "Failed to sync model to OpenCode", details: errText },
        { status: ocRes.status }
      )
    }

    // Set mode.title/summary so opencode uses this model for internal tasks
    await opencodeFetch("/global/config", {
      method: "PATCH",
      body: {
        mode: {
          title: { model: `${providerPrefix}/${modelID}` },
          summary: { model: `${providerPrefix}/${modelID}` },
        },
      },
    }).catch(() => { /* non-blocking */ })

    console.log(`[agent-ensure] Synced ${providerPrefix}/${modelID}`)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("[agent-ensure] Error:", e)
    return NextResponse.json(
      { error: "Failed to ensure model", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}
