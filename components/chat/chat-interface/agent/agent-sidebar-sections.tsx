import { EmptyCard, InfoList, PanelCard } from "./agent-sidebar-shared"
import { getWritablePathSummary, getFileIconStyle } from "./agent-sidebar-utils"
import type {
  ContainerInfo,
  FileDiff,
  FileStatus,
  ProviderInfo,
  VisibleProvider,
} from "./agent-sidebar-types"

export function AgentSidebarChangesPanel({
  currentSessionId,
  latestDiffs,
  statusByPath,
  onSelectDiff,
}: {
  currentSessionId?: string
  latestDiffs: FileDiff[]
  statusByPath: Record<string, FileStatus>
  onSelectDiff: (path: string) => void
}) {
  return (
    <div className="space-y-4">
      <PanelCard title="Session Diff" subtitle={currentSessionId || "No session selected"}>
        {latestDiffs.length > 0 ? (
          <div className="space-y-1">
            {latestDiffs.map((diff) => {
              const style = getFileIconStyle({ name: diff.file.split("/").pop() || "", path: diff.file, absolute: diff.file, type: "file", ignored: false })
              const FileIcon = style.icon
              return (
                <button
                  key={diff.file}
                  onClick={() => onSelectDiff(diff.file)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gradient-to-br ${style.gradient}`}>
                    <FileIcon className="h-3 w-3 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{diff.file}</div>
                    <div className="text-[11px] text-muted-foreground">
                      <span className="text-emerald-600">+{diff.additions}</span>
                      {" / "}
                      <span className="text-red-500">-{diff.deletions}</span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      diff.status === "added"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : diff.status === "deleted"
                          ? "bg-red-500/10 text-red-500"
                          : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {diff.status || "modified"}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No file diffs from the latest prompt.
          </p>
        )}
      </PanelCard>

      <PanelCard
        title="Workspace Status"
        subtitle={`${Object.keys(statusByPath).length} changed files`}
      >
        {Object.values(statusByPath).length > 0 ? (
          <div className="space-y-1">
            {Object.values(statusByPath).map((item) => (
              <div
                key={item.path}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{item.path}</div>
                  <div className="text-[11px] text-muted-foreground">
                    <span className="text-emerald-600">+{item.added}</span>
                    {" / "}
                    <span className="text-red-500">-{item.removed}</span>
                  </div>
                </div>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No workspace changes detected.</p>
        )}
      </PanelCard>
    </div>
  )
}

export function AgentSidebarSettingsPanel({
  containerInfo,
  providers,
  visibleProviders,
}: {
  containerInfo: ContainerInfo | null
  providers: ProviderInfo | null
  visibleProviders: VisibleProvider[]
}) {
  return (
    <div className="space-y-4">
      <PanelCard title="Docker" subtitle={containerInfo?.healthy ? "Healthy" : "Not ready"}>
        <InfoList
          items={[
            ["Status", containerInfo?.status || "unknown"],
            ["Version", containerInfo?.version || "unknown"],
            ["Container", containerInfo?.config?.containerName || "opencode-agent"],
            ["Image", containerInfo?.config?.imageName || "opencode-agent:latest"],
            ["Port", String(containerInfo?.config?.hostPort || 4096)],
            [
              "Port Range",
              containerInfo?.config?.portRange
                ? `${containerInfo.config.portRange.start}-${containerInfo.config.portRange.end}`
                : "14108-18108",
            ],
            ["Volume", containerInfo?.config?.workspaceVolume || "tmpfs (ephemeral)"],
            ["Home", containerInfo?.config?.homeVolume || "tmpfs (ephemeral)"],
            ["Workdir", containerInfo?.config?.workdir || "/workspace"],
            ["Writable", getWritablePathSummary(containerInfo?.config)],
            ["Home Dir", containerInfo?.config?.homeDir || "/home/opencode"],
            ["Bind", containerInfo?.config?.bindAddress || "127.0.0.1"],
            ["Network", containerInfo?.config?.networkName || "copilot-agent-sandbox"],
            ["Memory", containerInfo?.config?.limits.memory || "512m"],
            ["CPU", containerInfo?.config?.limits.cpus || "1"],
            ["PIDs", String(containerInfo?.config?.limits.pids || 256)],
            ["Idle Timeout", `${containerInfo?.config?.idleTimeoutMinutes || 30}m`],
            ["RO Rootfs", containerInfo?.config?.readOnlyRootfs ? "enabled" : "disabled"],
          ]}
        />
      </PanelCard>

      <PanelCard title="Providers" subtitle={`${visibleProviders.length} available`}>
        <InfoList
          items={[
            ["Connected", providers?.connected?.join(", ") || "none"],
            ["Default chat", providers?.default?.chat || "not set"],
            ["Default fast", providers?.default?.fast || "not set"],
          ]}
        />
      </PanelCard>
    </div>
  )
}

export function AgentSidebarProvidersPanel({
  visibleProviders,
}: {
  visibleProviders: VisibleProvider[]
}) {
  if (visibleProviders.length === 0) {
    return (
      <EmptyCard
        title="No providers"
        description="No synced providers or models to display."
      />
    )
  }

  return (
    <div className="space-y-4">
      {visibleProviders.map((provider) => (
        <PanelCard
          key={provider.id}
          title={provider.name || provider.id}
          subtitle={`${provider.visibleModels.length} synced models`}
        >
          <div className="space-y-1">
            {provider.visibleModels.map(([modelId, model]) => (
              <div
                key={modelId}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs"
              >
                <span className="truncate">{model.name || modelId}</span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {model.status}
                </span>
              </div>
            ))}
          </div>
        </PanelCard>
      ))}
    </div>
  )
}

export function AgentSidebarLogsPanel({
  logs,
  agentStatus,
}: {
  logs: string
  agentStatus: "idle" | "starting" | "connected" | "error"
}) {
  return (
    <PanelCard title="Container Logs" subtitle="tail -100">
      {logs ? (
        <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed">
          {logs}
        </pre>
      ) : (
        <p className="text-xs text-muted-foreground">
          {agentStatus === "connected" ? "No logs to display." : "Container not connected."}
        </p>
      )}
    </PanelCard>
  )
}
