"use client"

import {
  FileCode2,
  Folder,
  Logs,
  Plug,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react"
import { AgentSidebarExplorerPanel } from "./agent-sidebar-explorer"
import {
  AgentSidebarChangesPanel,
  AgentSidebarLogsPanel,
  AgentSidebarProvidersPanel,
  AgentSidebarSettingsPanel,
} from "./agent-sidebar-sections"
import { useAgentSidebarState } from "./use-agent-sidebar-state"
import type { DockPanel } from "./agent-sidebar-types"

const TABS: Array<{ id: DockPanel; label: string; icon: typeof Folder }> = [
  { id: "explorer", label: "Files", icon: Folder },
  { id: "changes", label: "Changes", icon: FileCode2 },
  { id: "settings", label: "Config", icon: Settings2 },
  { id: "providers", label: "Models", icon: Plug },
  { id: "logs", label: "Logs", icon: Logs },
]

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
  const sidebar = useAgentSidebarState({
    open,
    agentStatus,
    currentSessionId,
  })

  const statusColor =
    agentStatus === "connected"
      ? "bg-emerald-500"
      : agentStatus === "starting"
        ? "bg-amber-500"
        : agentStatus === "error"
          ? "bg-red-500"
          : "bg-muted-foreground/40"

  return (
    <aside
      className={`${open ? "flex" : "hidden"} h-full w-full flex-col overflow-hidden border-l border-border bg-background`}
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${statusColor}`} />
          <span className="text-sm font-medium">Sandbox</span>
          <span className="text-xs text-muted-foreground">{sidebar.liveLabel}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={sidebar.handleRefresh}
            disabled={sidebar.isRefreshing}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${sidebar.isRefreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = sidebar.activePanel === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => sidebar.setActivePanel(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-xs font-medium transition-colors ${
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Content — fills remaining height */}
      <div className="relative min-h-0 flex-1">
        {sidebar.activePanel === "explorer" && (
          <AgentSidebarExplorerPanel
            agentStatus={agentStatus}
            currentPath={sidebar.currentPath}
            homeDir={sidebar.containerInfo?.config?.homeDir || "/home/opencode"}
            tmpDir="/tmp"
            breadcrumbs={sidebar.breadcrumbs}
            uploadInputRef={sidebar.uploadInputRef}
            isUploading={sidebar.isUploading}
            onUpload={sidebar.handleUpload}
            onResetPath={() => sidebar.setCurrentPath("")}
            onOpenHome={() =>
              sidebar.setCurrentPath(
                sidebar.containerInfo?.config?.homeDir || "/home/opencode",
              )
            }
            onOpenTmp={() => sidebar.setCurrentPath("/tmp")}
            onSelectCrumb={sidebar.setCurrentPath}
            recentChangeEntries={sidebar.recentChangeEntries}
            sortedEntries={sidebar.sortedEntries}
            selectedPath={sidebar.selectedPath}
            setSelectedPath={sidebar.setSelectedPath}
            statusByPath={sidebar.statusByPath}
            latestDiffs={sidebar.latestDiffs}
            onOpenEntry={sidebar.openEntry}
            onJumpToRecentPath={sidebar.jumpToRecentPath}
            workspaceLoading={sidebar.workspaceLoading}
            selectedDiff={sidebar.selectedDiff}
            contentTab={sidebar.contentTab}
            onContentTabChange={sidebar.setContentTab}
            selectedContent={sidebar.selectedContent}
            fileLoading={sidebar.fileLoading}
          />
        )}

        {sidebar.activePanel === "changes" && (
          <div className="h-full overflow-y-auto p-4">
            <AgentSidebarChangesPanel
              currentSessionId={currentSessionId}
              latestDiffs={sidebar.latestDiffs}
              statusByPath={sidebar.statusByPath}
              onSelectDiff={(path) => {
                sidebar.setSelectedPath(path)
                sidebar.setActivePanel("explorer")
              }}
            />
          </div>
        )}

        {sidebar.activePanel === "settings" && (
          <div className="h-full overflow-y-auto p-4">
            <AgentSidebarSettingsPanel
              containerInfo={sidebar.containerInfo}
              providers={sidebar.providers}
              visibleProviders={sidebar.visibleProviders}
            />
          </div>
        )}

        {sidebar.activePanel === "providers" && (
          <div className="h-full overflow-y-auto p-4">
            <AgentSidebarProvidersPanel visibleProviders={sidebar.visibleProviders} />
          </div>
        )}

        {sidebar.activePanel === "logs" && (
          <div className="h-full overflow-y-auto p-4">
            <AgentSidebarLogsPanel logs={sidebar.logs} agentStatus={agentStatus} />
          </div>
        )}
      </div>
    </aside>
  )
}
