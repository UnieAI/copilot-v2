"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CircleCheck,
  CircleX,
  FileArchive,
  FileCode2,
  FileImage,
  FileText,
  Folder,
  HardDrive,
  Home,
  Loader2,
  Logs,
  Plug,
  RefreshCw,
  Settings2,
  Upload,
  X,
} from "lucide-react"
import {
  getOpencodeEventSnapshot,
  subscribeOpencodeEvents,
  subscribeOpencodeSnapshot,
} from "./opencode-events"

type ProviderInfo = {
  all: Array<{
    id: string
    source: string
    name: string
    models: Record<string, { id: string; name: string; status: string }>
  }>
  default: Record<string, string>
  connected: string[]
}

type AddedProvidersPayload = {
  providers?: Array<{
    id: string
    name?: string
    models?: Array<{ id: string; name?: string }>
  }>
}

type ContainerInfo = {
  version?: string
  healthy?: boolean
  status?: string
  config?: {
    containerName: string
    imageName: string
    hostPort: number
    workspaceVolume: string
    workdir: string
    limits: {
      memory: string
      cpus: string
      pids: number
    }
  }
}

type FileNode = {
  name: string
  path: string
  absolute: string
  type: "file" | "directory"
  ignored: boolean
}

type FileContent = {
  type: "text" | "binary"
  content: string
  diff?: string
  encoding?: "base64"
  mimeType?: string
}

type FileStatus = {
  path: string
  added: number
  removed: number
  status: "added" | "deleted" | "modified"
}

type SessionMessage = {
  info: {
    id: string
    role: "user" | "assistant"
    time?: { created?: number }
  }
}

type FileDiff = {
  file: string
  before: string
  after: string
  additions: number
  deletions: number
  status?: "added" | "deleted" | "modified"
}

type DockPanel = "explorer" | "changes" | "settings" | "providers" | "logs"

type DiffRow =
  | { kind: "context"; leftNumber: number | null; rightNumber: number | null; text: string }
  | { kind: "removed"; leftNumber: number | null; rightNumber: null; text: string }
  | { kind: "added"; leftNumber: null; rightNumber: number | null; text: string }

const API_BASE = "/api/agent/opencode"

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function getAddedIdsForProvider(
  addedModelsByProvider: Record<string, string[]>,
  providerId: string,
  providerName: string,
) {
  const keyCandidates = [
    providerId,
    providerName,
    providerId.replace(/[-_]/g, ""),
    providerName.replace(/[-_]/g, ""),
  ].map(normalize)

  const matched = Object.entries(addedModelsByProvider)
    .filter(([key]) => {
      const norm = normalize(key)
      return keyCandidates.includes(norm) || keyCandidates.includes(norm.replace(/[-_]/g, ""))
    })
    .flatMap(([, ids]) => ids)

  return new Set(matched.map(normalize))
}

function modelMatchesAdded(
  providerId: string,
  modelId: string,
  model: { id: string; name: string },
  addedIds: Set<string>,
) {
  if (addedIds.size === 0) return false
  const mids = [
    modelId,
    model.id,
    model.name,
    `${providerId}/${modelId}`,
    `${providerId}/${model.id}`,
  ].map(normalize)
  return mids.some((id) => addedIds.has(id))
}

function getFileIcon(node: FileNode | null) {
  if (node?.type === "directory") return Folder
  const name = node?.name || ""
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(name)) return FileImage
  if (/\.(ts|tsx|js|jsx|json|md|html|css|scss|py|sh|yaml|yml|sql|go|rs|java)$/i.test(name)) return FileCode2
  if (/\.(zip|tar|gz|rar|7z)$/i.test(name)) return FileArchive
  return FileText
}

function summarizeFile(path: string) {
  const parts = path.split("/").filter(Boolean)
  if (parts.length <= 2) return path || "/"
  return `.../${parts.slice(-2).join("/")}`
}

function inferPreviewMimeType(path: string | null, content: FileContent | null) {
  const explicit = content?.mimeType?.trim()
  if (explicit) return explicit

  const normalized = (path || "").toLowerCase()
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/.test(normalized)) {
    if (normalized.endsWith(".svg")) return "image/svg+xml"
    if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg"
    return `image/${normalized.split(".").pop()}`
  }
  if (normalized.endsWith(".pdf")) return "application/pdf"
  return ""
}

function isPreviewableMimeType(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType === "application/pdf"
}

function buildDiffRows(before: string, after: string): DiffRow[] {
  const beforeLines = before.split("\n")
  const afterLines = after.split("\n")

  let prefix = 0
  const maxPrefix = Math.min(beforeLines.length, afterLines.length)
  while (prefix < maxPrefix && beforeLines[prefix] === afterLines[prefix]) {
    prefix += 1
  }

  let beforeSuffix = beforeLines.length - 1
  let afterSuffix = afterLines.length - 1
  while (
    beforeSuffix >= prefix &&
    afterSuffix >= prefix &&
    beforeLines[beforeSuffix] === afterLines[afterSuffix]
  ) {
    beforeSuffix -= 1
    afterSuffix -= 1
  }

  const rows: DiffRow[] = []
  for (let index = 0; index < prefix; index += 1) {
    rows.push({
      kind: "context",
      leftNumber: index + 1,
      rightNumber: index + 1,
      text: beforeLines[index],
    })
  }

  for (let index = prefix; index <= beforeSuffix; index += 1) {
    rows.push({
      kind: "removed",
      leftNumber: index + 1,
      rightNumber: null,
      text: beforeLines[index] ?? "",
    })
  }

  for (let index = prefix; index <= afterSuffix; index += 1) {
    rows.push({
      kind: "added",
      leftNumber: null,
      rightNumber: index + 1,
      text: afterLines[index] ?? "",
    })
  }

  const suffixStartBefore = beforeSuffix + 1
  const suffixStartAfter = afterSuffix + 1
  const suffixLength = beforeLines.length - suffixStartBefore
  for (let offset = 0; offset < suffixLength; offset += 1) {
    rows.push({
      kind: "context",
      leftNumber: suffixStartBefore + offset + 1,
      rightNumber: suffixStartAfter + offset + 1,
      text: beforeLines[suffixStartBefore + offset] ?? "",
    })
  }

  return rows.length > 0
    ? rows
    : [
        {
          kind: "context",
          leftNumber: 1,
          rightNumber: 1,
          text: "",
        },
      ]
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init })
  if (!response.ok) {
    throw new Error(await response.text())
  }
  return response.json() as Promise<T>
}

function inferLiveLabel(currentSessionId?: string) {
  if (!currentSessionId) return "未綁定 session"
  const snapshot = getOpencodeEventSnapshot()
  const status = snapshot.statuses[currentSessionId]
  if (!status) return snapshot.connected ? "SSE 已連線" : "SSE 斷線"
  return status.type === "busy" || status.type === "retry" ? "同步中" : "待命中"
}

export function AgentSidebar({
  open = true,
  agentStatus,
  currentSessionId,
  onClose,
}: {
  open?: boolean
  agentStatus: "idle" | "starting" | "connected" | "error"
  currentSessionId?: string
  onClose: () => void
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
  const [contentTab, setContentTab] = useState<"preview" | "diff">("preview")
  const [fileLoading, setFileLoading] = useState(false)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [liveLabel, setLiveLabel] = useState(() => inferLiveLabel(currentSessionId))
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)

  const visibleProviders = useMemo(() => {
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

  const breadcrumbs = useMemo(() => {
    const parts = currentPath.split("/").filter(Boolean)
    return parts.map((part, index) => ({
      label: part,
      path: parts.slice(0, index + 1).join("/"),
    }))
  }, [currentPath])

  const statusIcon = () => {
    switch (agentStatus) {
      case "connected":
        return <CircleCheck className="h-4 w-4 text-emerald-500" />
      case "starting":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case "error":
        return <CircleX className="h-4 w-4 text-red-500" />
      default:
        return <HardDrive className="h-4 w-4 text-muted-foreground" />
    }
  }

  const fetchMeta = useCallback(async () => {
    const [containerRes, providerRes, addedProviderRes, logRes] = await Promise.allSettled([
      readJson<ContainerInfo>("/api/agent"),
      readJson<ProviderInfo>(`${API_BASE}/provider`),
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
      const nextEntries = await readJson<FileNode[]>(`${API_BASE}/file?path=${encodeURIComponent(path)}`)
      setEntries(nextEntries)
      setLastSyncedAt(Date.now())
    } finally {
      if (!options?.silent) {
        setWorkspaceLoading(false)
      }
    }
  }, [])

  const fetchStatuses = useCallback(async () => {
    const statuses = await readJson<FileStatus[]>(`${API_BASE}/file/status`)
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
      `${API_BASE}/session/${currentSessionId}/message?limit=40`,
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
      `${API_BASE}/session/${currentSessionId}/diff?messageID=${encodeURIComponent(latestUserMessage.info.id)}`,
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
      const content = await readJson<FileContent>(`${API_BASE}/file/content?path=${encodeURIComponent(path)}`)
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
    if (agentStatus === "idle") return
    void fetchMeta()
  }, [agentStatus, fetchMeta])

  useEffect(() => {
    if (agentStatus !== "connected") return
    void Promise.allSettled([fetchMeta(), fetchStatuses(), fetchLatestDiff()])
  }, [agentStatus, fetchLatestDiff, fetchMeta, fetchStatuses])

  useEffect(() => {
    if (agentStatus !== "connected") return
    void fetchDirectory(currentPath)
  }, [agentStatus, currentPath, fetchDirectory])

  useEffect(() => {
    if (agentStatus !== "connected") return
    void fetchSelectedContent(selectedPath)
  }, [agentStatus, fetchSelectedContent, selectedPath])

  useEffect(() => {
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
  }, [currentSessionId])

  useEffect(() => {
    if (agentStatus !== "connected") return
    if (!open) return
    return subscribeOpencodeEvents((event) => {
      const shouldRefresh =
        event.type === "session.created" ||
        event.type === "session.updated" ||
        event.type === "session.deleted" ||
        event.type === "session.idle" ||
        event.type === "message.updated" ||
        event.type === "message.removed" ||
        event.type === "message.part.updated"

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
    if (entry.type === "directory") {
      setSelectedPath(null)
      setCurrentPath(entry.path)
      return
    }

    setSelectedPath(entry.path)
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

  const renderPreview = () => {
    if (!selectedPath) {
      return (
        <EmptyCard
          title="未開啟檔案"
          description="點擊上方的檔案 icon 可直接開啟內容，資料夾則會進入下一層。"
        />
      )
    }

    if (fileLoading) {
      return (
        <div className="flex h-44 items-center justify-center rounded-2xl border border-border/60 bg-background/80">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )
    }

    if (!selectedContent) {
      return (
        <EmptyCard
          title="內容不可用"
          description="目前讀不到檔案內容，請重新整理後再試一次。"
        />
      )
    }

    const mimeType = inferPreviewMimeType(selectedPath, selectedContent)
    const previewUrl =
      selectedPath && isPreviewableMimeType(mimeType)
        ? `/api/agent/files/preview?path=${encodeURIComponent(selectedPath)}`
        : null

    if (previewUrl && mimeType.startsWith("image/")) {
      return (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-background/90 p-3">
          <img
            src={previewUrl}
            alt={selectedPath || "Image preview"}
            className="max-h-[28rem] w-full rounded-xl border border-border/50 object-contain"
          />
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>MIME: {mimeType}</div>
            <div>Source: Docker preview stream</div>
          </div>
        </div>
      )
    }

    if (previewUrl && mimeType === "application/pdf") {
      return (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-background/90 p-3">
          <iframe
            src={previewUrl}
            title={selectedPath || "PDF preview"}
            className="h-[30rem] w-full rounded-xl border border-border/50 bg-white"
          />
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>MIME: {mimeType}</div>
            <div>Source: Docker preview stream</div>
          </div>
        </div>
      )
    }

    if (contentTab === "diff" && selectedDiff) {
      const diffRows = buildDiffRows(selectedDiff.before, selectedDiff.after)
      return (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/90">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
            <span>{selectedDiff.status || "modified"}</span>
            <span>+{selectedDiff.additions} / -{selectedDiff.deletions}</span>
          </div>
          <div className="max-h-72 overflow-auto font-mono text-[11px]">
            {diffRows.map((row, index) => (
              <div
                key={`${row.kind}-${index}`}
                className={`grid grid-cols-[44px_44px_1fr] gap-2 px-3 py-1.5 ${
                  row.kind === "added"
                    ? "bg-emerald-500/8"
                    : row.kind === "removed"
                      ? "bg-red-500/8"
                      : "bg-transparent"
                }`}
              >
                <span className="text-right text-muted-foreground/70">{row.leftNumber ?? ""}</span>
                <span className="text-right text-muted-foreground/70">{row.rightNumber ?? ""}</span>
                <span className="whitespace-pre-wrap break-words text-foreground/90">
                  {row.kind === "added" ? "+" : row.kind === "removed" ? "-" : " "}
                  {row.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (selectedContent.type === "binary") {
      return (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-background/90 p-3">
          <div className="rounded-xl border border-dashed border-border/60 px-3 py-8 text-center text-xs text-muted-foreground">
            這是 binary 檔案，目前顯示 metadata。
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>MIME: {mimeType || "unknown"}</div>
            <div>Encoding: {selectedContent.encoding || "raw"}</div>
          </div>
        </div>
      )
    }

    return (
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/90">
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-5 text-foreground/90">
          {selectedContent.content}
        </pre>
      </div>
    )
  }

  return (
    <aside
      className={`${open ? "flex" : "hidden"} h-full w-[26rem] shrink-0 flex-col border-l border-border bg-[linear-gradient(180deg,rgba(245,247,250,0.92)_0%,rgba(255,255,255,0.98)_100%)]`}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {statusIcon()}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Sandbox Desktop</div>
            <div className="text-[11px] text-muted-foreground">
              {liveLabel}
              {lastSyncedAt ? ` · ${new Date(lastSyncedAt).toLocaleTimeString("zh-TW")}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-lg p-1.5 transition-colors hover:bg-muted"
            aria-label="重新整理"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-muted"
            aria-label="關閉"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {activePanel === "explorer" && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-white/90 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
                <div className="flex min-w-0 items-center gap-1 text-[11px]">
                  <button
                    onClick={() => setCurrentPath("")}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="回到根目錄"
                  >
                    <Home className="h-3.5 w-3.5" />
                  </button>
                  {breadcrumbs.map((crumb) => (
                    <button
                      key={crumb.path}
                      onClick={() => setCurrentPath(crumb.path)}
                      className="truncate rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {crumb.label}
                    </button>
                  ))}
                  {breadcrumbs.length === 0 && <span className="text-muted-foreground">/workspace</span>}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    ref={uploadInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => void handleUpload(event.target.files)}
                  />
                  <button
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={isUploading || agentStatus !== "connected"}
                    className="flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    上傳
                  </button>
                </div>
              </div>

              <div className="border-b border-border/50 px-3 py-2">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  最新變更
                </div>
                {recentChangeEntries.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {recentChangeEntries.map((path) => {
                      const isDirectory = sortedEntries.find((entry) => entry.path === path)?.type === "directory"
                      return (
                        <button
                          key={path}
                          onClick={() => {
                            if (isDirectory) {
                              setCurrentPath(path)
                              return
                            }
                            setSelectedPath(path)
                          }}
                          className="rounded-full border border-border/60 bg-muted/50 px-2 py-1 text-[11px] text-foreground/80 transition-colors hover:bg-muted"
                        >
                          {summarizeFile(path)}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">目前沒有新的檔案變更。</p>
                )}
              </div>

              <div className="p-3">
                {workspaceLoading ? (
                  <div className="flex h-28 items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : sortedEntries.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {sortedEntries.map((entry) => {
                      const Icon = getFileIcon(entry)
                      const status = statusByPath[entry.path] || latestDiffs.find((item) => item.file === entry.path)
                      return (
                        <button
                          key={entry.path}
                          onClick={() => openEntry(entry)}
                          className={`relative flex min-h-[84px] flex-col items-center justify-start rounded-2xl border px-2 py-3 text-center transition-colors ${
                            selectedPath === entry.path
                              ? "border-primary/60 bg-primary/5"
                              : "border-border/60 bg-muted/20 hover:bg-muted/40"
                          }`}
                        >
                          <Icon
                            className={`mb-2 h-7 w-7 ${
                              entry.type === "directory" ? "text-amber-500" : "text-sky-600"
                            }`}
                          />
                          <span className="line-clamp-2 text-[11px] font-medium leading-4 text-foreground/90">
                            {entry.name}
                          </span>
                          {status && (
                            <span
                              className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                                status.status === "added"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : status.status === "deleted"
                                    ? "bg-red-500/10 text-red-600"
                                    : "bg-amber-500/10 text-amber-600"
                              }`}
                            >
                              {status.status}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyCard title="資料夾是空的" description="這個目錄目前沒有可顯示的檔案。" />
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/60 bg-white/90 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-foreground/90">
                    {selectedPath || "檔案預覽"}
                  </div>
                  {latestDiffMessageId && (
                    <div className="text-[11px] text-muted-foreground">
                      最新 diff 來源: {latestDiffMessageId}
                    </div>
                  )}
                </div>
                {selectedDiff && (
                  <div className="flex items-center gap-1 rounded-full bg-muted/60 p-1">
                    {(["preview", "diff"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setContentTab(tab)}
                        className={`rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${
                          contentTab === tab
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground"
                        }`}
                      >
                        {tab === "preview" ? "內容" : "Diff"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-3">{renderPreview()}</div>
            </div>
          </div>
        )}

        {activePanel === "changes" && (
          <div className="space-y-3">
            <PanelCard title="Session Diff" subtitle={currentSessionId || "尚未選擇 session"}>
              {latestDiffs.length > 0 ? (
                <div className="space-y-2">
                  {latestDiffs.map((diff) => (
                    <button
                      key={diff.file}
                      onClick={() => {
                        setSelectedPath(diff.file)
                        setActivePanel("explorer")
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-left transition-colors hover:bg-muted/30"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-foreground">{diff.file}</div>
                        <div className="text-[11px] text-muted-foreground">
                          +{diff.additions} / -{diff.deletions}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                          diff.status === "added"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : diff.status === "deleted"
                              ? "bg-red-500/10 text-red-600"
                              : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {diff.status || "modified"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  這個 session 最近一則 user prompt 還沒有產生可顯示的檔案 diff。
                </p>
              )}
            </PanelCard>

            <PanelCard title="Workspace Status" subtitle={`${Object.keys(statusByPath).length} 個變更檔案`}>
              {Object.values(statusByPath).length > 0 ? (
                <div className="space-y-2">
                  {Object.values(statusByPath).map((item) => (
                    <div
                      key={item.path}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{item.path}</div>
                        <div className="text-[11px] text-muted-foreground">
                          +{item.added} / -{item.removed}
                        </div>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">目前 workspace 沒有 git status 變更。</p>
              )}
            </PanelCard>
          </div>
        )}

        {activePanel === "settings" && (
          <div className="space-y-3">
            <PanelCard title="Docker" subtitle={containerInfo?.healthy ? "Healthy" : "Not ready"}>
              <InfoList
                items={[
                  ["狀態", containerInfo?.status || "unknown"],
                  ["版本", containerInfo?.version || "unknown"],
                  ["容器", containerInfo?.config?.containerName || "opencode-agent"],
                  ["映像", containerInfo?.config?.imageName || "opencode-agent:latest"],
                  ["Port", String(containerInfo?.config?.hostPort || 4096)],
                  ["Volume", containerInfo?.config?.workspaceVolume || "opencode-agent-workspace"],
                  ["Workdir", containerInfo?.config?.workdir || "/workspace"],
                  ["Memory", containerInfo?.config?.limits.memory || "512m"],
                  ["CPU", containerInfo?.config?.limits.cpus || "1"],
                  ["PIDs", String(containerInfo?.config?.limits.pids || 256)],
                ]}
              />
            </PanelCard>

            <PanelCard title="Providers" subtitle={`${visibleProviders.length} 個可用供應商`}>
              <InfoList
                items={[
                  ["已連線", providers?.connected?.join(", ") || "無"],
                  ["預設 chat", providers?.default?.chat || "未設定"],
                  ["預設 fast", providers?.default?.fast || "未設定"],
                ]}
              />
            </PanelCard>
          </div>
        )}

        {activePanel === "providers" && (
          <div className="space-y-3">
            {visibleProviders.length > 0 ? (
              visibleProviders.map((provider) => (
                <PanelCard
                  key={provider.id}
                  title={provider.name || provider.id}
                  subtitle={`${provider.visibleModels.length} 個已同步模型`}
                >
                  <div className="space-y-1.5">
                    {provider.visibleModels.map(([modelId, model]) => (
                      <div
                        key={modelId}
                        className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-xs"
                      >
                        <span className="truncate text-foreground">{model.name || modelId}</span>
                        <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                          {model.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </PanelCard>
              ))
            ) : (
              <EmptyCard title="無供應商資料" description="目前還沒有可顯示的已同步 provider / model。" />
            )}
          </div>
        )}

        {activePanel === "logs" && (
          <PanelCard title="Container Logs" subtitle="tail -100">
            {logs ? (
              <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap break-all rounded-xl bg-background/80 p-3 font-mono text-[11px] leading-5 text-foreground/85">
                {logs}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground">
                {agentStatus === "connected" ? "目前沒有可顯示的日誌。" : "容器未連線。"}
              </p>
            )}
          </PanelCard>
        )}
      </div>

      <div className="border-t border-border/60 bg-white/90 px-2 py-2">
        <div className="grid grid-cols-5 gap-1.5">
          {[
            { id: "explorer", label: "檔案", icon: Folder },
            { id: "changes", label: "Diff", icon: FileCode2 },
            { id: "settings", label: "設定", icon: Settings2 },
            { id: "providers", label: "模型", icon: Plug },
            { id: "logs", label: "日誌", icon: Logs },
          ].map((item) => {
            const Icon = item.icon
            const active = activePanel === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActivePanel(item.id as DockPanel)}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-[10px] font-medium transition-colors ${
                  active
                    ? "border-primary/40 bg-primary/8 text-foreground"
                    : "border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

function PanelCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-white/90 shadow-sm">
      <div className="border-b border-border/50 px-3 py-2">
        <div className="text-xs font-semibold text-foreground/90">{title}</div>
        {subtitle ? <div className="text-[11px] text-muted-foreground">{subtitle}</div> : null}
      </div>
      <div className="p-3">{children}</div>
    </section>
  )
}

function EmptyCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-3 py-8 text-center">
      <div className="mb-1 text-xs font-semibold text-foreground/80">{title}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </div>
  )
}

function InfoList({
  items,
}: {
  items: Array<[string, string]>
}) {
  return (
    <div className="space-y-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-3 text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="break-all text-right font-medium text-foreground">{value}</span>
        </div>
      ))}
    </div>
  )
}
