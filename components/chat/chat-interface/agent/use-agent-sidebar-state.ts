"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  getOpencodeEventSnapshot,
  subscribeOpencodeEvents,
  subscribeOpencodeSnapshot,
} from "./opencode-events"
import type {
  AddedProvidersPayload,
  ContainerInfo,
  DockPanel,
  FileContent,
  FileDiff,
  FileNode,
  FileStatus,
  ProviderInfo,
  SessionMessage,
  VisibleProvider,
} from "./agent-sidebar-types"
import {
  AGENT_SIDEBAR_API_BASE,
  getAddedIdsForProvider,
  inferLiveLabel,
  modelMatchesAdded,
  readJson,
} from "./agent-sidebar-utils"

type ContentTab = "preview" | "diff"

export function useAgentSidebarState({
  open,
  agentStatus,
  currentSessionId,
}: {
  open: boolean
  agentStatus: "idle" | "starting" | "connected" | "error"
  currentSessionId?: string
}) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const eventRefreshTimeoutRef = useRef<number | null>(null)
  const [activePanel, setActivePanel] = useState<DockPanel>("explorer")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [logs, setLogs] = useState("")
  const [providers, setProviders] = useState<ProviderInfo | null>(null)
  const [addedModelsByProvider, setAddedModelsByProvider] = useState<Record<string, string[]>>({})
  const [containerInfo, setContainerInfo] = useState<ContainerInfo | null>(null)
  const [currentPath, setCurrentPath] = useState("")
  const [entries, setEntries] = useState<FileNode[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [selectedContent, setSelectedContent] = useState<FileContent | null>(null)
  const [statusByPath, setStatusByPath] = useState<Record<string, FileStatus>>({})
  const [latestDiffs, setLatestDiffs] = useState<FileDiff[]>([])
  const [latestDiffMessageId, setLatestDiffMessageId] = useState<string | null>(null)
  const [contentTab, setContentTab] = useState<ContentTab>("preview")
  const [fileLoading, setFileLoading] = useState(false)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [liveLabel, setLiveLabel] = useState(() => inferLiveLabel(currentSessionId))
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)

  const visibleProviders = useMemo<VisibleProvider[]>(() => {
    return (providers?.all || [])
      .map((provider) => {
        const entries = Object.entries(provider.models || {})
        const addedIds = getAddedIdsForProvider(addedModelsByProvider, provider.id, provider.name)
        const visibleModels = entries.filter(([modelId, model]) =>
          modelMatchesAdded(provider.id, modelId, model, addedIds),
        )

        return {
          ...provider,
          visibleModels,
        }
      })
      .filter((provider) => provider.visibleModels.length > 0)
  }, [addedModelsByProvider, providers?.all])

  const selectedDiff = useMemo(() => {
    if (!selectedPath) return null
    return latestDiffs.find((diff) => diff.file === selectedPath) || null
  }, [latestDiffs, selectedPath])

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [entries])

  const recentChangeEntries = useMemo(() => {
    const diffPaths = latestDiffs.map((diff) => diff.file)
    const statusPaths = Object.keys(statusByPath)
    return Array.from(new Set([...diffPaths, ...statusPaths])).slice(0, 8)
  }, [latestDiffs, statusByPath])

  const selectedEntry = useMemo(() => {
    if (!selectedPath) return null
    return entries.find((entry) => entry.path === selectedPath || entry.absolute === selectedPath) || null
  }, [entries, selectedPath])

  const breadcrumbs = useMemo(() => {
    const parts = currentPath.split("/").filter(Boolean)
    const isAbsolute = currentPath.startsWith("/")
    return parts.map((part, index) => {
      const nextPath = parts.slice(0, index + 1).join("/")
      return {
        label: part,
        path: isAbsolute ? `/${nextPath}` : nextPath,
      }
    })
  }, [currentPath])

  const fetchMeta = useCallback(async () => {
    const [containerRes, providerRes, addedProviderRes, logRes] = await Promise.allSettled([
      readJson<ContainerInfo>("/api/agent"),
      readJson<ProviderInfo>(`${AGENT_SIDEBAR_API_BASE}/provider`),
      readJson<AddedProvidersPayload>("/api/agent/providers"),
      readJson<{ logs?: string }>("/api/agent/logs"),
    ])

    if (containerRes.status === "fulfilled") {
      setContainerInfo(containerRes.value)
    }
    if (providerRes.status === "fulfilled") {
      setProviders(providerRes.value)
    }
    if (addedProviderRes.status === "fulfilled") {
      const next = (addedProviderRes.value.providers || []).reduce<Record<string, string[]>>((acc, provider) => {
        const ids = (provider.models || [])
          .map((model) => model.id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
        if (provider.id) acc[provider.id] = ids
        if (provider.name && !acc[provider.name]) acc[provider.name] = ids
        return acc
      }, {})
      setAddedModelsByProvider(next)
    }
    if (logRes.status === "fulfilled") {
      setLogs(logRes.value.logs || "")
    }
  }, [])

  const fetchDirectory = useCallback(async (path: string, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setWorkspaceLoading(true)
    }
    try {
      const nextEntries = await readJson<FileNode[]>(
        `${AGENT_SIDEBAR_API_BASE}/file?path=${encodeURIComponent(path)}`,
      )
      setEntries(nextEntries)
      setLastSyncedAt(Date.now())
    } finally {
      if (!options?.silent) {
        setWorkspaceLoading(false)
      }
    }
  }, [])

  const fetchStatuses = useCallback(async () => {
    const statuses = await readJson<FileStatus[]>(`${AGENT_SIDEBAR_API_BASE}/file/status`)
    const next = statuses.reduce<Record<string, FileStatus>>((acc, item) => {
      acc[item.path] = item
      return acc
    }, {})
    setStatusByPath(next)
  }, [])

  const fetchLatestDiff = useCallback(async () => {
    if (!currentSessionId) {
      setLatestDiffs([])
      setLatestDiffMessageId(null)
      return
    }

    const messages = await readJson<SessionMessage[]>(
      `${AGENT_SIDEBAR_API_BASE}/session/${currentSessionId}/message?limit=40`,
    )

    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.info.role === "user")

    if (!latestUserMessage) {
      setLatestDiffs([])
      setLatestDiffMessageId(null)
      return
    }

    setLatestDiffMessageId(latestUserMessage.info.id)
    const diffs = await readJson<FileDiff[]>(
      `${AGENT_SIDEBAR_API_BASE}/session/${currentSessionId}/diff?messageID=${encodeURIComponent(latestUserMessage.info.id)}`,
    )
    setLatestDiffs(diffs)
  }, [currentSessionId])

  const fetchSelectedContent = useCallback(async (path: string | null, options?: { silent?: boolean }) => {
    if (!path) {
      setSelectedContent(null)
      return
    }

    if (!options?.silent) {
      setFileLoading(true)
    }
    try {
      const content = await readJson<FileContent>(
        `${AGENT_SIDEBAR_API_BASE}/file/content?path=${encodeURIComponent(path)}`,
      )
      setSelectedContent(content)
      setLastSyncedAt(Date.now())
    } finally {
      if (!options?.silent) {
        setFileLoading(false)
      }
    }
  }, [])

  const refreshWorkspace = useCallback(
    async (options?: { includeMeta?: boolean; silent?: boolean }) => {
      if (!options?.silent) {
        setIsRefreshing(true)
      }
      try {
        const tasks: Promise<unknown>[] = [
          fetchDirectory(currentPath, { silent: options?.silent }),
          fetchStatuses(),
          fetchLatestDiff(),
        ]
        if (selectedPath && !options?.silent) {
          tasks.push(fetchSelectedContent(selectedPath, { silent: options?.silent }))
        }
        if (options?.includeMeta) {
          tasks.push(fetchMeta())
        }
        await Promise.allSettled(tasks)
      } finally {
        if (!options?.silent) {
          setIsRefreshing(false)
        }
      }
    },
    [currentPath, fetchDirectory, fetchLatestDiff, fetchMeta, fetchSelectedContent, fetchStatuses, selectedPath],
  )

  useEffect(() => {
    if (!open) return
    if (agentStatus === "idle") return
    void fetchMeta()
  }, [agentStatus, fetchMeta, open])

  useEffect(() => {
    if (!open) return
    if (agentStatus !== "connected") return
    void Promise.allSettled([fetchMeta(), fetchStatuses(), fetchLatestDiff()])
  }, [agentStatus, fetchLatestDiff, fetchMeta, fetchStatuses, open])

  useEffect(() => {
    if (!open) return
    if (agentStatus !== "connected") return
    void fetchDirectory(currentPath)
  }, [agentStatus, currentPath, fetchDirectory, open])

  useEffect(() => {
    if (!open) return
    if (agentStatus !== "connected") return
    void fetchSelectedContent(selectedPath)
  }, [agentStatus, fetchSelectedContent, open, selectedPath])

  useEffect(() => {
    if (!open) return
    setLiveLabel(inferLiveLabel(currentSessionId))
    return subscribeOpencodeSnapshot(() => {
      const snapshot = getOpencodeEventSnapshot()
      const status = currentSessionId ? snapshot.statuses[currentSessionId] : null
      const nextLabel = !currentSessionId
        ? snapshot.connected
          ? "SSE 已連線"
          : "SSE 斷線"
        : status?.type === "busy" || status?.type === "retry"
          ? "同步中"
          : snapshot.connected
            ? "待命中"
            : "SSE 斷線"
      setLiveLabel(nextLabel)
    })
  }, [currentSessionId, open])

  useEffect(() => {
    if (agentStatus !== "connected") return
    if (!open) return
    return subscribeOpencodeEvents((event) => {
      const shouldRefresh =
        event.type === "session.created" ||
        event.type === "session.updated" ||
        event.type === "session.deleted" ||
        event.type === "session.idle"

      if (!shouldRefresh) {
        return
      }

      if (eventRefreshTimeoutRef.current) {
        window.clearTimeout(eventRefreshTimeoutRef.current)
      }

      eventRefreshTimeoutRef.current = window.setTimeout(() => {
        void refreshWorkspace({ silent: true })
      }, 450)
    })
  }, [agentStatus, open, refreshWorkspace])

  useEffect(() => {
    if (agentStatus !== "connected" || !open || !currentSessionId) return

    const interval = window.setInterval(() => {
      const status = getOpencodeEventSnapshot().statuses[currentSessionId]
      const isBusy = status?.type === "busy" || status?.type === "retry"
      if (!isBusy) return
      void refreshWorkspace({ silent: true })
    }, 1800)

    return () => {
      window.clearInterval(interval)
    }
  }, [agentStatus, currentSessionId, open, refreshWorkspace])

  useEffect(() => {
    return () => {
      if (eventRefreshTimeoutRef.current) {
        window.clearTimeout(eventRefreshTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (selectedDiff) {
      setContentTab("diff")
      return
    }
    setContentTab("preview")
  }, [selectedDiff])

  const openEntry = useCallback((entry: FileNode) => {
    const targetPath = entry.absolute || entry.path
    if (entry.type === "directory") {
      setSelectedPath(null)
      setCurrentPath(targetPath)
      return
    }

    setSelectedPath(targetPath)
    setActivePanel("explorer")
  }, [])

  const handleRefresh = useCallback(() => {
    void refreshWorkspace({ includeMeta: true })
  }, [refreshWorkspace])

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return
      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.set("path", currentPath)
        for (const file of Array.from(files)) {
          formData.append("files", file)
        }

        const response = await fetch("/api/agent/files/upload", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          throw new Error(await response.text())
        }

        await refreshWorkspace()
      } finally {
        setIsUploading(false)
        if (uploadInputRef.current) {
          uploadInputRef.current.value = ""
        }
      }
    },
    [currentPath, refreshWorkspace],
  )

  const jumpToRecentPath = useCallback((path: string) => {
    const isDirectory = sortedEntries.find((entry) => entry.path === path)?.type === "directory"
    if (isDirectory) {
      setCurrentPath(path)
      return
    }
    setSelectedPath(path)
  }, [sortedEntries])

  return {
    uploadInputRef,
    activePanel,
    setActivePanel,
    isRefreshing,
    isUploading,
    logs,
    providers,
    containerInfo,
    currentPath,
    setCurrentPath,
    selectedPath,
    setSelectedPath,
    selectedContent,
    statusByPath,
    latestDiffs,
    latestDiffMessageId,
    contentTab,
    setContentTab,
    fileLoading,
    workspaceLoading,
    liveLabel,
    lastSyncedAt,
    visibleProviders,
    selectedDiff,
    sortedEntries,
    recentChangeEntries,
    selectedEntry,
    breadcrumbs,
    openEntry,
    handleRefresh,
    handleUpload,
    jumpToRecentPath,
  }
}
