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

    // Build the PATCH payload for opencode: inject our DB providers
    if (rawProviders.length > 0) {
      const providerConfig: Record<string, any> = {}
      for (const p of rawProviders) {
        providerConfig[p.id] = {
          name: p.providerName,
          npm: "@ai-sdk/openai-compatible",
          options: {
            baseURL: p.apiUrl,
            apiKey: p.apiKey,
          },
          models: p.models.reduce<Record<string, { name: string }>>((acc, model) => {
            acc[model.id] = { name: model.name }
            return acc
          }, {}),
        }
      }

      const ocRes = await opencodeFetch("/config", {
        method: "PATCH",
        body: { provider: providerConfig },
      })
      if (!ocRes.ok) {
        console.error("[agent-sync-models] OpenCode config patch failed", await ocRes.text())
      }
    }

    // Read the FULL provider list from opencode — this is the source of truth.
    // It includes both persistent opencode.json providers AND our dynamically patched ones.
    const ocProviderRes = await opencodeFetch("/provider")
    let providers: Array<{ id: string; name: string; models: Array<{ id: string; name: string }> }> = []
    let defaults: Record<string, string> = {}

    if (ocProviderRes.ok) {
      const ocData = await ocProviderRes.json() as {
        providers?: Array<{
          id: string
          name: string
          models: Record<string, { id: string; name: string; status?: string }> | Array<{ id: string; name: string }>
        }>
        default?: Record<string, string>
      }

      // The /provider response is an array or object — handle both shapes
      const rawList = Array.isArray(ocData) ? ocData : (ocData.providers ?? [])

      for (const p of rawList) {
        if (!p?.id || p.id === "opencode") continue // skip the cloud provider

        const modelSource = p.models
        const modelEntries = Array.isArray(modelSource)
          ? modelSource
          : Object.values(modelSource ?? {})

        const modelList = (modelEntries as any[])
          .map((m: any) => ({ id: String(m?.id || ""), name: String(m?.name || m?.id || "") }))
          .filter((m) => m.id)

        if (modelList.length > 0) {
          providers.push({ id: p.id, name: p.name || p.id, models: modelList })
          if (!defaults[p.id] && modelList[0]?.id) {
            defaults[p.id] = modelList[0].id
          }
        }
      }
    }

    // Fallback: if /provider returned nothing useful, derive from our DB providers
    if (providers.length === 0 && rawProviders.length > 0) {
      for (const p of rawProviders) {
        providers.push({ id: p.id, name: p.providerName, models: p.models })
        if (p.models[0]?.id) defaults[p.id] = p.models[0].id
      }
    }

    // Patch mode.title so opencode uses a user provider for internal tasks (title generation, etc.)
    // instead of defaulting to the 'opencode' cloud provider which may not be authenticated.
    try {
      const ocConfigRes = await opencodeFetch("/config")
      if (ocConfigRes.ok) {
        const ocConfig = (await ocConfigRes.json()) as {
          provider?: Record<string, { models?: Record<string, any>; blacklist?: string[] }>
        }
        let bestModelStr: string | null = null
        for (const [pid, pdata] of Object.entries(ocConfig.provider || {})) {
          if (pid === "opencode") continue
          const blacklist = new Set(pdata.blacklist || [])
          const validModel = Object.keys(pdata.models || {}).find((m) => !blacklist.has(m))
          if (validModel) {
            bestModelStr = `${pid}/${validModel}`
            break
          }
        }
        if (bestModelStr) {
          await opencodeFetch("/config", {
            method: "PATCH",
            body: { mode: { title: { model: bestModelStr }, summary: { model: bestModelStr } } },
          }).catch(() => { /* non-blocking */ })
        }
      }
    } catch { /* non-blocking */ }

    return NextResponse.json({ providers, default: defaults })
  } catch (e: any) {
    console.error("[agent-sync-models] Error mapping providers:", e)
    return NextResponse.json(
      { error: "Failed to sync available models", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}
