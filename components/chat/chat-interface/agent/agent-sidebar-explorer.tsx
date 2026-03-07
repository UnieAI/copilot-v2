import type { RefObject } from "react"
import {
  ArrowLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FolderOpen,
  Home,
  Loader2,
  Upload,
  X,
} from "lucide-react"
import {
  buildDiffRows,
  getFileIconStyle,
  inferPreviewMimeType,
  isPreviewableMimeType,
  summarizeFile,
} from "./agent-sidebar-utils"
import type {
  FileContent,
  FileDiff,
  FileNode,
  FileStatus,
} from "./agent-sidebar-types"

type ContentTab = "preview" | "diff"

/* ─── File Grid Item ─── */
function FileGridItem({
  entry,
  isSelected,
  status,
  onClick,
}: {
  entry: FileNode
  isSelected: boolean
  status?: { status: string }
  onClick: () => void
}) {
  const style = getFileIconStyle(entry)
  const Icon = style.icon

  return (
    <button
      onClick={onClick}
      className={`group flex w-20 flex-col items-center gap-1 rounded-lg p-2 text-center transition-colors ${
        isSelected
          ? "bg-accent"
          : "hover:bg-accent/50"
      }`}
    >
      <div className={`relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${style.gradient} shadow-sm`}>
        <Icon className="h-5 w-5 text-white" />
        {status && (
          <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-background ${
            status.status === "added"
              ? "bg-emerald-500"
              : status.status === "deleted"
                ? "bg-red-500"
                : "bg-amber-500"
          }`} />
        )}
      </div>
      <span className="line-clamp-2 w-full text-[11px] leading-tight text-foreground/80 group-hover:text-foreground">
        {entry.name}
      </span>
    </button>
  )
}

/* ─── Preview Overlay ─── */
function PreviewOverlay({
  selectedPath,
  selectedContent,
  selectedDiff,
  contentTab,
  onContentTabChange,
  fileLoading,
  sortedEntries,
  onClose,
}: {
  selectedPath: string
  selectedContent: FileContent | null
  selectedDiff: FileDiff | null
  contentTab: ContentTab
  onContentTabChange: (tab: ContentTab) => void
  fileLoading: boolean
  sortedEntries: FileNode[]
  onClose: () => void
}) {
  const fileName = selectedPath.split("/").pop() || selectedPath
  const entry = sortedEntries.find((e) => e.path === selectedPath || e.absolute === selectedPath)
  const style = getFileIconStyle(entry || null)
  const FileIcon = style.icon

  const previewUrl = `/api/agent/files/preview?path=${encodeURIComponent(selectedPath)}`
  const downloadUrl = `/api/agent/files/preview?path=${encodeURIComponent(selectedPath)}&download=1`

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-background">
      {/* Preview header */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
        <button
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gradient-to-br ${style.gradient}`}>
          <FileIcon className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{fileName}</span>

        <div className="flex items-center gap-1">
          {selectedDiff && (
            <div className="flex items-center rounded-md border border-border p-0.5">
              {(["preview", "diff"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => onContentTabChange(tab)}
                  className={`rounded-sm px-2 py-0.5 text-xs font-medium transition-colors ${
                    contentTab === tab
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "preview" ? "Preview" : "Diff"}
                </button>
              ))}
            </div>
          )}
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href={downloadUrl}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Preview body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {fileLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !selectedContent ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Cannot read file content.
          </div>
        ) : (() => {
          const mimeType = inferPreviewMimeType(selectedPath, selectedContent)
          const canPreview = isPreviewableMimeType(mimeType)

          if (canPreview && mimeType.startsWith("image/")) {
            return (
              <img
                src={previewUrl}
                alt={fileName}
                className="mx-auto max-h-[60vh] rounded-md border border-border object-contain"
              />
            )
          }

          if (canPreview && mimeType === "application/pdf") {
            return (
              <iframe
                src={previewUrl}
                title={fileName}
                className="h-[60vh] w-full rounded-md border border-border bg-white"
              />
            )
          }

          if (contentTab === "diff" && selectedDiff) {
            const diffRows = buildDiffRows(selectedDiff.before, selectedDiff.after)
            return (
              <div className="overflow-hidden rounded-md border border-border">
                <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5 text-xs">
                  <span className="font-medium text-muted-foreground">{selectedDiff.status || "modified"}</span>
                  <span className="text-muted-foreground">
                    <span className="text-emerald-600">+{selectedDiff.additions}</span>
                    {" "}
                    <span className="text-red-500">-{selectedDiff.deletions}</span>
                  </span>
                </div>
                <div className="overflow-auto font-mono text-xs leading-5">
                  {diffRows.map((row, index) => (
                    <div
                      key={`${row.kind}-${index}`}
                      className={`grid grid-cols-[2rem_2rem_1fr] px-2 py-px ${
                        row.kind === "added"
                          ? "bg-emerald-500/10"
                          : row.kind === "removed"
                            ? "bg-red-500/10"
                            : ""
                      }`}
                    >
                      <span className="select-none text-right text-muted-foreground/50">{row.leftNumber ?? ""}</span>
                      <span className="select-none text-right text-muted-foreground/50">{row.rightNumber ?? ""}</span>
                      <span className="whitespace-pre-wrap break-words pl-2">
                        {row.kind === "added" ? "+" : row.kind === "removed" ? "-" : " "}{row.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          }

          if (selectedContent.type === "binary") {
            return (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Binary file · {mimeType || "unknown"}
              </div>
            )
          }

          return (
            <pre className="overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed">
              {selectedContent.content}
            </pre>
          )
        })()}
      </div>
    </div>
  )
}

/* ─── Main Explorer Panel ─── */
export function AgentSidebarExplorerPanel({
  agentStatus,
  currentPath,
  homeDir,
  tmpDir,
  breadcrumbs,
  uploadInputRef,
  isUploading,
  onUpload,
  onResetPath,
  onOpenHome,
  onOpenTmp,
  onSelectCrumb,
  recentChangeEntries,
  sortedEntries,
  selectedPath,
  setSelectedPath,
  statusByPath,
  latestDiffs,
  onOpenEntry,
  onJumpToRecentPath,
  workspaceLoading,
  selectedDiff,
  contentTab,
  onContentTabChange,
  selectedContent,
  fileLoading,
}: {
  agentStatus: "idle" | "starting" | "connected" | "error"
  currentPath: string
  homeDir: string
  tmpDir: string
  breadcrumbs: Array<{ label: string; path: string }>
  uploadInputRef: RefObject<HTMLInputElement | null>
  isUploading: boolean
  onUpload: (files: FileList | null) => Promise<void>
  onResetPath: () => void
  onOpenHome: () => void
  onOpenTmp: () => void
  onSelectCrumb: (path: string) => void
  recentChangeEntries: string[]
  sortedEntries: FileNode[]
  selectedPath: string | null
  setSelectedPath: (path: string | null) => void
  statusByPath: Record<string, FileStatus>
  latestDiffs: FileDiff[]
  onOpenEntry: (entry: FileNode) => void
  onJumpToRecentPath: (path: string) => void
  workspaceLoading: boolean
  selectedDiff: FileDiff | null
  contentTab: ContentTab
  onContentTabChange: (tab: ContentTab) => void
  selectedContent: FileContent | null
  fileLoading: boolean
}) {
  const hasParent = breadcrumbs.length > 0

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        {/* Back */}
        <button
          onClick={hasParent ? () => onSelectCrumb(breadcrumbs[breadcrumbs.length - 2]?.path || "") : onResetPath}
          disabled={!hasParent && !currentPath}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Breadcrumbs */}
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-xs">
          <button
            onClick={onResetPath}
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
          >
            <Home className="h-3.5 w-3.5" />
          </button>
          {breadcrumbs.length > 0 ? (
            breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex shrink-0 items-center">
                <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                <button
                  onClick={() => onSelectCrumb(crumb.path)}
                  className={`rounded-sm px-1 py-0.5 transition-colors hover:text-foreground ${
                    i === breadcrumbs.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {crumb.label}
                </button>
              </span>
            ))
          ) : (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
              <span className="px-1 py-0.5 font-medium">{currentPath || "workspace"}</span>
            </>
          )}
        </div>

        {/* Root toggles */}
        <div className="flex items-center rounded-md border border-border">
          <button
            onClick={onResetPath}
            className={`rounded-l-[5px] px-2 py-1 text-[11px] font-medium transition-colors ${
              !currentPath || !currentPath.startsWith(homeDir)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Work
          </button>
          <button
            onClick={onOpenHome}
            className={`border-l border-border px-2 py-1 text-[11px] font-medium transition-colors ${
              currentPath === homeDir || currentPath.startsWith(`${homeDir}/`)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Home
          </button>
          <button
            onClick={onOpenTmp}
            className={`rounded-r-[5px] border-l border-border px-2 py-1 text-[11px] font-medium transition-colors ${
              currentPath === tmpDir || currentPath.startsWith(`${tmpDir}/`)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tmp
          </button>
        </div>

        {/* Upload */}
        <input
          ref={uploadInputRef as RefObject<HTMLInputElement>}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void onUpload(event.target.files)}
        />
        <button
          onClick={() => uploadInputRef.current?.click()}
          disabled={isUploading || agentStatus !== "connected"}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
          title="Upload"
        >
          {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Recent changes */}
      {recentChangeEntries.length > 0 && (
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-1.5">
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Recent
          </span>
          {recentChangeEntries.map((path) => (
            <button
              key={path}
              onClick={() => onJumpToRecentPath(path)}
              className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {summarizeFile(path)}
            </button>
          ))}
        </div>
      )}

      {/* File grid — takes remaining space */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {workspaceLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sortedEntries.length > 0 ? (
          <div className="flex flex-wrap content-start gap-0.5">
            {sortedEntries.map((entry) => {
              const status =
                statusByPath[entry.path] ||
                latestDiffs.find((item) => item.file === entry.path)
              return (
                <FileGridItem
                  key={entry.path}
                  entry={entry}
                  isSelected={selectedPath === entry.path}
                  status={status}
                  onClick={() => onOpenEntry(entry)}
                />
              )
            })}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <FolderOpen className="h-10 w-10 opacity-30" />
            <span className="text-sm">Empty folder</span>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex shrink-0 items-center justify-between border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>{sortedEntries.length} items</span>
        <span>{currentPath || "/workspace"}</span>
      </div>

      {/* Preview overlay — covers the entire panel */}
      {selectedPath && sortedEntries.find((e) => e.path === selectedPath || e.absolute === selectedPath)?.type !== "directory" && (
        <PreviewOverlay
          selectedPath={selectedPath}
          selectedContent={selectedContent}
          selectedDiff={selectedDiff}
          contentTab={contentTab}
          onContentTabChange={onContentTabChange}
          fileLoading={fileLoading}
          sortedEntries={sortedEntries}
          onClose={() => setSelectedPath(null)}
        />
      )}
    </div>
  )
}
