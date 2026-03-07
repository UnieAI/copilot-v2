import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { getProvidersWithKeysForUser } from "@/lib/agent/providers"
import { opencodeFetch, readResponsePayload } from "@/lib/agent/opencode"

export const runtime = "nodejs"

type EnsureRequest = {
  providerPrefix?: string
  modelID?: string
}

/**
 * Ensure the selected provider/model is registered in OpenCode global config.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: EnsureRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const providerPrefix = String(body.providerPrefix || "")
  const modelID = String(body.modelID || "")
  if (!providerPrefix || !modelID) {
    return NextResponse.json({ error: "providerPrefix and modelID are required" }, { status: 400 })
  }

  try {
    const providers = await getProvidersWithKeysForUser(session.user.id as string)
    const provider = providers.find((p) => p.id === providerPrefix)
    if (!provider) {
      return NextResponse.json(
        { error: `Provider ${providerPrefix} not found for current user` },
        { status: 404 },
      )
    }

    const model = provider.models.find((m) => m.id === modelID)
    if (!model) {
      return NextResponse.json(
        { error: `Model ${modelID} not found in provider ${providerPrefix}` },
        { status: 404 },
      )
    }

    const modelRef = `${providerPrefix}/${modelID}`

    let existingProviderModels: Record<string, any> = {}
    let disabledProviders: string[] = []

    try {
      const currentRes = await opencodeFetch("/global/config")
      if (currentRes.ok) {
        const currentPayload = await readResponsePayload(currentRes)
        const currentConfig = (currentPayload?.data ?? currentPayload ?? {}) as any

        existingProviderModels = currentConfig?.provider?.[providerPrefix]?.models || {}
        const currentDisabled = Array.isArray(currentConfig?.disabled_providers)
          ? currentConfig.disabled_providers
          : []
        disabledProviders = currentDisabled.filter((id: unknown) => String(id) !== providerPrefix)
      }
    } catch {
      // Continue with defaults if current config cannot be read.
    }

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
            ...existingProviderModels,
            [modelID]: {
              ...(existingProviderModels?.[modelID] || {}),
              name: model.name,
            },
          },
        },
      },
      disabled_providers: disabledProviders,
      model: modelRef,
      small_model: modelRef,
      mode: {
        title: { model: modelRef },
        summary: { model: modelRef },
      },
    }

    const syncRes = await opencodeFetch("/global/config", {
      method: "PATCH",
      body: patchBody,
    })

    if (!syncRes.ok) {
      const details = await readResponsePayload(syncRes)
      return NextResponse.json(
        { error: "Failed to sync model to OpenCode", details },
        { status: syncRes.status },
      )
    }

    return NextResponse.json({ success: true, model: modelRef })
  } catch (e: any) {
    console.error("[agent/providers/ensure] Error:", e)
    return NextResponse.json(
      { error: "Failed to ensure provider/model", details: e?.message || "Unknown error" },
      { status: 500 },
    )
  }
}
