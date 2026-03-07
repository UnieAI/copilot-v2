"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Database, Shield, Cpu, MemoryStick, TimerReset } from "lucide-react"
import { adminUpdateUserAgentSettingsAction } from "@/app/[locale]/(main)/admin/settings/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

type AgentSettingValues = {
  workspacePersistence: boolean
  memoryMb: number
  cpuMillicores: number
  pidLimit: number
  idleTimeoutMinutes: number
}

type AgentUserRow = {
  id: string
  name: string | null
  email: string
  role: string
  settings: {
    useCustomSettings: boolean
    defaults: AgentSettingValues
    overrides: {
      workspacePersistence: boolean | null
      memoryMb: number | null
      cpuMillicores: number | null
      pidLimit: number | null
      idleTimeoutMinutes: number | null
    }
    effective: AgentSettingValues & {
      assignedPort: number
    }
  }
  runtime: {
    imageName: string
    containerName: string
    workspaceVolume: string | null
    homeVolume: string | null
    workdir: string
    homeDir: string
    hostPort: number
    bindAddress: string
    networkName: string
    portRange: {
      start: number
      end: number
    }
    workspacePersistence: boolean
    idleTimeoutMinutes: number
    readOnlyRootfs: boolean
    limits: {
      memory: string
      memoryMb: number
      cpus: string
      cpuMillicores: number
      pids: number
    }
  }
}

interface AgentSandboxPanelProps {
  users: AgentUserRow[]
}

function getWritablePathSummary(runtime: AgentUserRow["runtime"]) {
  return [runtime.workdir, runtime.homeDir, "/tmp", "/run"].join(", ")
}

function RuntimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
      <p className="text-sm font-medium">{label}</p>
      <code className="max-w-[60%] break-all text-xs text-muted-foreground text-right">{value}</code>
    </div>
  )
}

export function AgentSandboxPanel({ users }: AgentSandboxPanelProps) {
  const router = useRouter()
  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.email.localeCompare(b.email)),
    [users],
  )
  const [selectedUserId, setSelectedUserId] = useState(sortedUsers[0]?.id || "")
  const [isPending, startTransition] = useTransition()
  const selectedUser = sortedUsers.find((user) => user.id === selectedUserId) || sortedUsers[0]

  const [form, setForm] = useState({
    useCustomSettings: Boolean(selectedUser?.settings.useCustomSettings),
    workspacePersistence: selectedUser?.settings.overrides.workspacePersistence ?? selectedUser?.settings.effective.workspacePersistence ?? true,
    memoryMb: String(selectedUser?.settings.overrides.memoryMb ?? selectedUser?.settings.effective.memoryMb ?? 2048),
    cpuMillicores: String(selectedUser?.settings.overrides.cpuMillicores ?? selectedUser?.settings.effective.cpuMillicores ?? 1000),
    pidLimit: String(selectedUser?.settings.overrides.pidLimit ?? selectedUser?.settings.effective.pidLimit ?? 256),
    idleTimeoutMinutes: String(
      selectedUser?.settings.overrides.idleTimeoutMinutes ?? selectedUser?.settings.effective.idleTimeoutMinutes ?? 30,
    ),
  })

  useEffect(() => {
    if (!selectedUser) return
    setForm({
      useCustomSettings: selectedUser.settings.useCustomSettings,
      workspacePersistence:
        selectedUser.settings.overrides.workspacePersistence ?? selectedUser.settings.effective.workspacePersistence,
      memoryMb: String(selectedUser.settings.overrides.memoryMb ?? selectedUser.settings.effective.memoryMb),
      cpuMillicores: String(
        selectedUser.settings.overrides.cpuMillicores ?? selectedUser.settings.effective.cpuMillicores,
      ),
      pidLimit: String(selectedUser.settings.overrides.pidLimit ?? selectedUser.settings.effective.pidLimit),
      idleTimeoutMinutes: String(
        selectedUser.settings.overrides.idleTimeoutMinutes ?? selectedUser.settings.effective.idleTimeoutMinutes,
      ),
    })
  }, [selectedUserId, selectedUser])

  const handleSave = () => {
    if (!selectedUser) return

    startTransition(async () => {
      try {
        await adminUpdateUserAgentSettingsAction({
          userId: selectedUser.id,
          useCustomSettings: form.useCustomSettings,
          workspacePersistence: form.workspacePersistence,
          memoryMb: Number(form.memoryMb),
          cpuMillicores: Number(form.cpuMillicores),
          pidLimit: Number(form.pidLimit),
          idleTimeoutMinutes: Number(form.idleTimeoutMinutes),
        })
        toast.success(`已更新 ${selectedUser.email} 的 sandbox 設定`)
        router.refresh()
      } catch (error: any) {
        toast.error(error?.message || "更新失敗")
      }
    })
  }

  if (!selectedUser) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-sm text-muted-foreground">
        目前沒有可管理的使用者。
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-border/30 bg-background/40 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold">選擇使用者</h3>
            <p className="text-xs text-muted-foreground mt-1">針對指定 user 設定 sandbox override；未覆寫時吃系統預設。</p>
          </div>

          <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {sortedUsers.map((user) => {
              const active = user.id === selectedUserId
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUserId(user.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-primary/40 bg-primary/10"
                      : "border-border/40 bg-background hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium truncate">{user.name || user.email}</p>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{user.role}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {user.settings.useCustomSettings ? "Custom override" : "System default"}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-border/30 bg-background/40 p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedUser.name || selectedUser.email}</h3>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
              </div>
              <div className="rounded-full border border-border/50 px-3 py-1 text-xs text-muted-foreground">
                {selectedUser.role}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium">使用個人 override</p>
                <p className="text-xs text-muted-foreground">關閉時清空 override，直接回退到系統預設。</p>
              </div>
              <Switch
                checked={form.useCustomSettings}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, useCustomSettings: checked }))}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="agent-user-memory">記憶體上限 (MB)</Label>
                <Input
                  id="agent-user-memory"
                  inputMode="numeric"
                  disabled={!form.useCustomSettings}
                  value={form.memoryMb}
                  onChange={(event) => setForm((prev) => ({ ...prev, memoryMb: event.target.value }))}
                />
                {!form.useCustomSettings && (
                  <p className="text-xs text-muted-foreground">系統預設：{selectedUser.settings.defaults.memoryMb} MB</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-user-cpu">CPU 上限 (millicores)</Label>
                <Input
                  id="agent-user-cpu"
                  inputMode="numeric"
                  disabled={!form.useCustomSettings}
                  value={form.cpuMillicores}
                  onChange={(event) => setForm((prev) => ({ ...prev, cpuMillicores: event.target.value }))}
                />
                {!form.useCustomSettings && (
                  <p className="text-xs text-muted-foreground">系統預設：{selectedUser.settings.defaults.cpuMillicores}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-user-pid">PID 上限</Label>
                <Input
                  id="agent-user-pid"
                  inputMode="numeric"
                  disabled={!form.useCustomSettings}
                  value={form.pidLimit}
                  onChange={(event) => setForm((prev) => ({ ...prev, pidLimit: event.target.value }))}
                />
                {!form.useCustomSettings && (
                  <p className="text-xs text-muted-foreground">系統預設：{selectedUser.settings.defaults.pidLimit}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-user-timeout">閒置逾時 (分鐘)</Label>
                <Input
                  id="agent-user-timeout"
                  inputMode="numeric"
                  disabled={!form.useCustomSettings}
                  value={form.idleTimeoutMinutes}
                  onChange={(event) => setForm((prev) => ({ ...prev, idleTimeoutMinutes: event.target.value }))}
                />
                {!form.useCustomSettings && (
                  <p className="text-xs text-muted-foreground">
                    系統預設：{selectedUser.settings.defaults.idleTimeoutMinutes} 分鐘
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium">保留工作區</p>
                <p className="text-xs text-muted-foreground">關閉時改用 tmpfs，container 重啟後不保留檔案。</p>
              </div>
              <Switch
                checked={form.workspacePersistence}
                disabled={!form.useCustomSettings}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, workspacePersistence: checked }))}
              />
            </div>

            <Button type="button" onClick={handleSave} disabled={isPending} className="rounded-xl">
              {isPending ? "儲存中..." : "儲存此使用者設定"}
            </Button>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="rounded-[24px] border border-border/30 bg-background/40 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">隔離資訊</h3>
              </div>
              <RuntimeRow label="Container" value={selectedUser.runtime.containerName} />
              <RuntimeRow label="Workspace Volume" value={selectedUser.runtime.workspaceVolume || "tmpfs (ephemeral)"} />
              <RuntimeRow label="Home Volume" value={selectedUser.runtime.homeVolume || "tmpfs (ephemeral)"} />
              <RuntimeRow label="Workdir" value={selectedUser.runtime.workdir} />
              <RuntimeRow label="File API Root" value={selectedUser.runtime.workdir} />
              <RuntimeRow label="Writable Paths" value={getWritablePathSummary(selectedUser.runtime)} />
              <RuntimeRow label="Home Dir" value={selectedUser.runtime.homeDir} />
              <RuntimeRow label="Bind Address" value={selectedUser.runtime.bindAddress} />
              <RuntimeRow label="Docker Network" value={selectedUser.runtime.networkName} />
              <RuntimeRow label="Host Port" value={String(selectedUser.runtime.hostPort)} />
              <RuntimeRow
                label="Port Range"
                value={`${selectedUser.runtime.portRange.start}-${selectedUser.runtime.portRange.end}`}
              />
              <RuntimeRow label="Image" value={selectedUser.runtime.imageName} />
              <RuntimeRow label="Read-only Rootfs" value={selectedUser.runtime.readOnlyRootfs ? "enabled" : "disabled"} />
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-border/50 bg-background px-4 py-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MemoryStick className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide">Memory</span>
                </div>
                <p className="mt-3 text-lg font-semibold">{selectedUser.runtime.limits.memory}</p>
              </div>

              <div className="rounded-2xl border border-border/50 bg-background px-4 py-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Cpu className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide">CPU</span>
                </div>
                <p className="mt-3 text-lg font-semibold">{selectedUser.runtime.limits.cpus}</p>
              </div>

              <div className="rounded-2xl border border-border/50 bg-background px-4 py-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide">PID</span>
                </div>
                <p className="mt-3 text-lg font-semibold">{selectedUser.runtime.limits.pids}</p>
              </div>

              <div className="rounded-2xl border border-border/50 bg-background px-4 py-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TimerReset className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide">Idle Timeout</span>
                </div>
                <p className="mt-3 text-lg font-semibold">{selectedUser.runtime.idleTimeoutMinutes}m</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
