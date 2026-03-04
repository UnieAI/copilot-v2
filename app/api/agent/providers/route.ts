import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { getAvailableModelsForUser } from "@/lib/available-models"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id as string

  try {
    const models = await getAvailableModelsForUser(userId)
    const providerMap = new Map<string, {
      id: string
      name: string
      models: Array<{ id: string; name: string }>
    }>()

    for (const model of models) {
      const prefix = model.providerPrefix
      const item = providerMap.get(prefix) || {
        id: prefix,
        name: model.providerName || prefix,
        models: [],
      }
      if (!item.models.some((m) => m.id === model.label)) {
        item.models.push({ id: model.label, name: model.label })
      }
      providerMap.set(prefix, item)
    }

    const providers = Array.from(providerMap.values())
    const defaults = providers.reduce<Record<string, string>>((acc, provider) => {
      const first = provider.models[0]
      if (first?.id) acc[provider.id] = first.id
      return acc
    }, {})

    return NextResponse.json({
      providers,
      default: defaults,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to resolve available models", details: e?.message || "Unknown error" },
      { status: 502 }
    )
  }
}
