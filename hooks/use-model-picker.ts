"use client"

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import type { AvailableModel } from "@/components/chat/types"

export type ModelGroupEntry = {
  gName: string
  filtered: AvailableModel[]
  total: number
}

export function useModelPicker({
  availableModels,
  selectedModel,
  setSelectedModel,
  sessionId,
}: {
  availableModels: AvailableModel[]
  selectedModel: string
  setSelectedModel: Dispatch<SetStateAction<string>>
  sessionId?: string
}) {
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [modelSearch, setModelSearch] = useState("")

  const selectedModelObj = useMemo(
    () => availableModels.find((m) => m.value === selectedModel),
    [availableModels, selectedModel]
  )

  const selectedModelLabel = selectedModelObj
    ? `${selectedModelObj.label}`
    : (selectedModel || "未選擇模型")

  const handleModelChange = useCallback((modelValue: string) => {
    setSelectedModel(modelValue)
    setModelPickerOpen(false)

    const modelObj = availableModels.find((m) => m.value === modelValue)
    if (!modelObj) return

    fetch("/api/user/preference", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedModel: modelObj.label,
        selectedProviderPrefix: modelObj.providerPrefix,
      }),
    }).catch(() => {})

    if (sessionId) {
      fetch(`/api/chat/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelName: modelObj.label,
          providerPrefix: modelObj.providerPrefix,
        }),
      }).catch(() => {})
    }
  }, [availableModels, sessionId, setSelectedModel])

  const searchTerm = modelSearch.trim().toLowerCase()
  const matchesSearch = (text?: string) => text?.toLowerCase().includes(searchTerm)

  const userModels = availableModels.filter((m) => !m.source || m.source === "user")
  const filteredUserModels = searchTerm
    ? userModels.filter((m) => matchesSearch(m.label) || matchesSearch(m.providerName))
    : userModels

  const groupModels = availableModels.filter((m) => m.source === "group")
  const groupMap = new Map<string, AvailableModel[]>()
  groupModels.forEach((m) => {
    const name = m.groupName || "群組"
    if (!groupMap.has(name)) groupMap.set(name, [])
    groupMap.get(name)!.push(m)
  })

  const groupEntries: ModelGroupEntry[] = [...groupMap.entries()]
    .map(([gName, gModels]) => {
      const filtered = searchTerm
        ? gModels.filter((m) =>
          matchesSearch(m.label) ||
          matchesSearch(m.providerName) ||
          matchesSearch(gName)
        )
        : gModels
      return { gName, filtered, total: gModels.length }
    })
    .filter(({ filtered, gName }) => filtered.length > 0 || matchesSearch(gName))

  const globalModels = availableModels.filter((m) => m.source === "global")
  const filteredGlobalModels = searchTerm
    ? globalModels.filter((m) =>
      matchesSearch(m.label) ||
      matchesSearch(m.providerName) ||
      matchesSearch("global providers")
    )
    : globalModels

  const hasAnyMatch =
    filteredUserModels.length > 0 ||
    filteredGlobalModels.length > 0 ||
    groupEntries.length > 0

  return {
    modelPickerOpen,
    setModelPickerOpen,
    modelSearch,
    setModelSearch,
    selectedModelObj,
    selectedModelLabel,
    handleModelChange,
    filteredUserModels,
    filteredGlobalModels,
    groupEntries,
    hasAnyMatch,
  }
}
