import {
  FileArchive,
  FileCode2,
  FileImage,
  FileText,
  Folder,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  FileJson,
  File,
} from "lucide-react"
import { getOpencodeEventSnapshot } from "./opencode-events"
import type { ContainerInfo, DiffRow, FileContent, FileNode } from "./agent-sidebar-types"

export const AGENT_SIDEBAR_API_BASE = "/api/agent/opencode"

function normalize(value: string) {
  return value.trim().toLowerCase()
}

export function getAddedIdsForProvider(
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

export function modelMatchesAdded(
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

export type FileIconStyle = {
  icon: typeof Folder
  gradient: string
  iconColor: string
}

export function getFileIconStyle(node: FileNode | null): FileIconStyle {
  if (node?.type === "directory") {
    return { icon: Folder, gradient: "from-blue-400 to-blue-600", iconColor: "text-white" }
  }
  const name = node?.name || ""
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(name)) {
    return { icon: FileImage, gradient: "from-pink-400 to-purple-500", iconColor: "text-white" }
  }
  if (/\.(mp4|mov|avi|mkv|webm)$/i.test(name)) {
    return { icon: FileVideo, gradient: "from-purple-500 to-violet-600", iconColor: "text-white" }
  }
  if (/\.(mp3|wav|ogg|flac|aac)$/i.test(name)) {
    return { icon: FileAudio, gradient: "from-emerald-400 to-emerald-600", iconColor: "text-white" }
  }
  if (/\.(ts|tsx|js|jsx|py|sh|go|rs|java|rb|php|c|cpp|h|hpp|swift|kt)$/i.test(name)) {
    return { icon: FileCode2, gradient: "from-cyan-400 to-blue-500", iconColor: "text-white" }
  }
  if (/\.(json|jsonl|json5)$/i.test(name)) {
    return { icon: FileJson, gradient: "from-amber-400 to-orange-500", iconColor: "text-white" }
  }
  if (/\.(yaml|yml|toml|ini|cfg|conf|env)$/i.test(name)) {
    return { icon: File, gradient: "from-slate-400 to-slate-600", iconColor: "text-white" }
  }
  if (/\.(md|mdx|txt|log|rst)$/i.test(name)) {
    return { icon: FileText, gradient: "from-gray-300 to-gray-500", iconColor: "text-white" }
  }
  if (/\.(html|css|scss|less|xml|xsl)$/i.test(name)) {
    return { icon: FileCode2, gradient: "from-orange-400 to-red-500", iconColor: "text-white" }
  }
  if (/\.(csv|xlsx|xls|ods)$/i.test(name)) {
    return { icon: FileSpreadsheet, gradient: "from-green-400 to-green-600", iconColor: "text-white" }
  }
  if (/\.(pdf)$/i.test(name)) {
    return { icon: FileText, gradient: "from-red-400 to-red-600", iconColor: "text-white" }
  }
  if (/\.(sql)$/i.test(name)) {
    return { icon: FileCode2, gradient: "from-indigo-400 to-indigo-600", iconColor: "text-white" }
  }
  if (/\.(zip|tar|gz|rar|7z|bz2)$/i.test(name)) {
    return { icon: FileArchive, gradient: "from-yellow-500 to-amber-600", iconColor: "text-white" }
  }
  return { icon: FileText, gradient: "from-slate-300 to-slate-400", iconColor: "text-white" }
}

export function getFileIcon(node: FileNode | null) {
  return getFileIconStyle(node).icon
}

export function summarizeFile(path: string) {
  const parts = path.split("/").filter(Boolean)
  if (parts.length <= 2) return path || "/"
  return `.../${parts.slice(-2).join("/")}`
}

export function inferPreviewMimeType(path: string | null, content: FileContent | null) {
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

export function isPreviewableMimeType(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType === "application/pdf"
}

export function buildDiffRows(before: string, after: string): DiffRow[] {
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

export async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init })
  if (!response.ok) {
    throw new Error(await response.text())
  }
  return response.json() as Promise<T>
}

export function inferLiveLabel(currentSessionId?: string) {
  if (!currentSessionId) return "No session"
  const snapshot = getOpencodeEventSnapshot()
  const status = snapshot.statuses[currentSessionId]
  if (!status) return snapshot.connected ? "Connected" : "Disconnected"
  return status.type === "busy" || status.type === "retry" ? "Syncing" : "Ready"
}

export function getWritablePathSummary(config?: ContainerInfo["config"]) {
  return [
    config?.workdir || "/workspace",
    config?.homeDir || "/home/opencode",
    "/tmp",
    "/run",
  ].join(", ")
}
