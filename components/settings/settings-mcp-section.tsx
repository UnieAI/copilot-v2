"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, Satellite, BookOpenText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { McpToolDialog, type McpFormData } from "@/components/settings/mcp-tool-dialog"
import {
  AgentSkillDialog,
  type AgentSkillFormData,
} from "@/components/settings/agent-skill-dialog"
import {
  AgentMcpDialog,
  type AgentMcpFormData,
} from "@/components/settings/agent-mcp-dialog"
import {
  actionAddAgentSkill,
  actionAddAgentMcpServer,
  actionAddMcpTool,
  actionDeleteAgentSkill,
  actionDeleteAgentMcpServer,
  actionDeleteMcpTool,
  actionToggleAgentSkill,
  actionToggleAgentMcpServer,
  actionUpdateAgentSkill,
  actionToggleMcpTool,
  actionUpdateAgentMcpServer,
  actionUpdateMcpTool,
} from "@/app/[locale]/(main)/settings/actions"
import type { McpTool } from "@/lib/db/schema"
import type { AgentRemoteMcpServer } from "@/lib/agent/mcp-config"
import type { AgentSkillDefinition } from "@/lib/agent/skill-config"

interface SettingsMcpSectionProps {
  initialTools: McpTool[]
  initialAgentMcpServers: AgentRemoteMcpServer[]
  initialAgentSkills: AgentSkillDefinition[]
}

function normalizeSkillName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function buildAgentFormData(server: AgentRemoteMcpServer) {
  return {
    previousId: server.id,
    id: server.id,
    url: server.config.url,
    enabled: server.config.enabled !== false,
    timeoutMs: server.config.timeout ? String(server.config.timeout) : "",
    disableOauth: server.config.oauth === false,
    headers: Object.entries(server.config.headers || {}).map(([key, value]) => ({ key, value })),
  } satisfies AgentMcpFormData & { previousId: string }
}

export function SettingsMcpSection({
  initialTools,
  initialAgentMcpServers,
  initialAgentSkills,
}: SettingsMcpSectionProps) {
  const [tools, setTools] = useState<McpTool[]>(initialTools)
  const [agentServers, setAgentServers] = useState<AgentRemoteMcpServer[]>(initialAgentMcpServers)
  const [agentSkills, setAgentSkills] = useState<AgentSkillDefinition[]>(initialAgentSkills)
  const [toolDialogOpen, setToolDialogOpen] = useState(false)
  const [agentDialogOpen, setAgentDialogOpen] = useState(false)
  const [agentSkillDialogOpen, setAgentSkillDialogOpen] = useState(false)
  const [editingTool, setEditingTool] = useState<McpTool | null>(null)
  const [editingAgentServer, setEditingAgentServer] = useState<AgentRemoteMcpServer | null>(null)
  const [editingAgentSkill, setEditingAgentSkill] = useState<AgentSkillDefinition | null>(null)
  const [isPending, startTransition] = useTransition()

  const openCreateTool = () => {
    setEditingTool(null)
    setToolDialogOpen(true)
  }

  const openEditTool = (tool: McpTool) => {
    setEditingTool(tool)
    setToolDialogOpen(true)
  }

  const openCreateAgentServer = () => {
    setEditingAgentServer(null)
    setAgentDialogOpen(true)
  }

  const openEditAgentServer = (server: AgentRemoteMcpServer) => {
    setEditingAgentServer(server)
    setAgentDialogOpen(true)
  }

  const openCreateAgentSkill = () => {
    setEditingAgentSkill(null)
    setAgentSkillDialogOpen(true)
  }

  const openEditAgentSkill = (skill: AgentSkillDefinition) => {
    setEditingAgentSkill(skill)
    setAgentSkillDialogOpen(true)
  }

  const getInfo = (tool: McpTool) => (tool.info as Record<string, string>) || {}

  const handleToolSave = async (data: McpFormData, id?: string) => {
    const payload = {
      url: data.url,
      path: data.path,
      key: data.apiKey,
      name: data.name,
      description: data.description,
    }

    if (id) {
      await actionUpdateMcpTool(id, payload)
      setTools((prev) =>
        prev.map((tool) =>
          tool.id === id
            ? {
                ...tool,
                url: data.url,
                path: data.path,
                key: data.apiKey || null,
                info: { name: data.name, description: data.description },
              }
            : tool
        )
      )
      return
    }

    await actionAddMcpTool(payload)
    window.location.reload()
  }

  const handleAgentSave = async (data: AgentMcpFormData, previousId?: string) => {
    const payload = {
      id: data.id,
      url: data.url,
      enabled: data.enabled,
      timeoutMs: data.timeoutMs ? Number(data.timeoutMs) : null,
      disableOauth: data.disableOauth,
      headers: data.headers,
    }

    const nextServer: AgentRemoteMcpServer = {
      id: payload.id,
      config: {
        type: "remote",
        url: payload.url,
        enabled: payload.enabled,
        ...(payload.timeoutMs ? { timeout: payload.timeoutMs } : {}),
        ...(payload.disableOauth ? { oauth: false } : {}),
        ...(payload.headers.some((header) => header.key.trim() && header.value.trim())
          ? {
              headers: Object.fromEntries(
                payload.headers
                  .map((header) => [header.key.trim(), header.value.trim()] as const)
                  .filter(([key, value]) => key && value)
              ),
            }
          : {}),
      },
    }

    if (previousId) {
      await actionUpdateAgentMcpServer(previousId, payload)
      setAgentServers((prev) =>
        prev
          .filter((server) => server.id !== previousId)
          .concat(nextServer)
          .sort((a, b) => a.id.localeCompare(b.id))
      )
      return
    }

    await actionAddAgentMcpServer(payload)
    setAgentServers((prev) =>
      prev
        .filter((server) => server.id !== nextServer.id)
        .concat(nextServer)
        .sort((a, b) => a.id.localeCompare(b.id))
    )
  }

  const handleAgentSkillSave = async (data: AgentSkillFormData, id?: string) => {
    const payload = {
      name: normalizeSkillName(data.name),
      description: data.description,
      content: data.content,
      isEnabled: data.isEnabled,
    }

    if (id) {
      await actionUpdateAgentSkill(id, payload)
      setAgentSkills((prev) =>
        prev
          .map((skill) =>
            skill.id === id
              ? {
                  ...skill,
                  ...payload,
                }
              : skill
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      return
    }

    await actionAddAgentSkill(payload)
    window.location.reload()
  }

  const handleDelete = (tool: McpTool) => {
    if (!confirm(`確定要刪除「${getInfo(tool).name || tool.url}」嗎？`)) return

    startTransition(async () => {
      try {
        await actionDeleteMcpTool(tool.id)
        setTools((prev) => prev.filter((item) => item.id !== tool.id))
        toast.success("已刪除 MCP 工具")
      } catch {
        toast.error("刪除失敗")
      }
    })
  }

  const handleAgentDelete = (server: AgentRemoteMcpServer) => {
    if (!confirm(`確定要刪除 Agent MCP「${server.id}」嗎？`)) return

    startTransition(async () => {
      try {
        await actionDeleteAgentMcpServer(server.id)
        setAgentServers((prev) => prev.filter((item) => item.id !== server.id))
        toast.success("已刪除 Agent MCP")
      } catch {
        toast.error("刪除失敗")
      }
    })
  }

  const handleAgentSkillDelete = (skill: AgentSkillDefinition) => {
    if (!confirm(`確定要刪除 Agent Skill「${skill.name}」嗎？`)) return

    startTransition(async () => {
      try {
        await actionDeleteAgentSkill(skill.id)
        setAgentSkills((prev) => prev.filter((item) => item.id !== skill.id))
        toast.success("已刪除 Agent Skill")
      } catch {
        toast.error("刪除失敗")
      }
    })
  }

  const handleToggle = (tool: McpTool) => {
    startTransition(async () => {
      try {
        await actionToggleMcpTool(tool.id, tool.isActive)
        setTools((prev) =>
          prev.map((item) =>
            item.id === tool.id ? { ...item, isActive: item.isActive === 1 ? 0 : 1 } : item
          )
        )
      } catch {
        toast.error("切換失敗")
      }
    })
  }

  const handleAgentToggle = (server: AgentRemoteMcpServer) => {
    const nextEnabled = server.config.enabled === false

    startTransition(async () => {
      try {
        await actionToggleAgentMcpServer(server.id, nextEnabled)
        setAgentServers((prev) =>
          prev.map((item) =>
            item.id === server.id
              ? { ...item, config: { ...item.config, enabled: nextEnabled } }
              : item
          )
        )
      } catch {
        toast.error("切換失敗")
      }
    })
  }

  const handleAgentSkillToggle = (skill: AgentSkillDefinition) => {
    const nextEnabled = !skill.isEnabled

    startTransition(async () => {
      try {
        await actionToggleAgentSkill(skill.id, nextEnabled)
        setAgentSkills((prev) =>
          prev.map((item) =>
            item.id === skill.id
              ? { ...item, isEnabled: nextEnabled }
              : item
          )
        )
      } catch {
        toast.error("切換失敗")
      }
    })
  }

  const editingToolInitial = editingTool
    ? {
        id: editingTool.id,
        name: getInfo(editingTool).name || "",
        description: getInfo(editingTool).description || "",
        url: editingTool.url,
        apiKey: editingTool.key || "",
        path: editingTool.path,
      }
    : undefined

  const editingAgentInitial = editingAgentServer
    ? buildAgentFormData(editingAgentServer)
    : undefined

  const editingAgentSkillInitial = editingAgentSkill
    ? {
        id: editingAgentSkill.id,
        name: editingAgentSkill.name,
        description: editingAgentSkill.description,
        content: editingAgentSkill.content,
        isEnabled: editingAgentSkill.isEnabled,
      }
    : undefined

  return (
    <>
      <section className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Agent Skills</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                以 Postgres 儲存使用者自訂 skills，啟用 Agent mode 時自動寫入 opencode skills 目錄。
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={openCreateAgentSkill}
              className="gap-1.5 h-10 px-5 rounded-xl border border-input/60 shadow-sm hover:bg-muted transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              新增 Skill
            </Button>
          </div>

          {agentSkills.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
              尚未設定任何 Agent Skill
            </div>
          ) : (
            <div className="space-y-2">
              {agentSkills.map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-background hover:bg-muted/50 transition-colors shadow-sm"
                >
                  <span className="text-muted-foreground shrink-0 text-lg">
                    <BookOpenText className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{skill.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {skill.description || "未填寫描述"}
                      {skill.content ? ` · ${skill.content.split(/\r?\n/, 1)[0]}` : ""}
                    </p>
                  </div>

                  <button
                    onClick={() => handleAgentSkillToggle(skill)}
                    disabled={isPending}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors shrink-0 font-medium ${
                      skill.isEnabled
                        ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                        : "bg-muted text-muted-foreground border-border/50"
                    }`}
                  >
                    {skill.isEnabled ? "啟用" : "停用"}
                  </button>

                  <button
                    onClick={() => openEditAgentSkill(skill)}
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted active:scale-95"
                    title="編輯"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleAgentSkillDelete(skill)}
                    disabled={isPending}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10 active:scale-95"
                    title="刪除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Agent Remote MCP</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                僅供 Agent sandbox 使用，會依 opencode `mcp` schema 注入 container，不影響下方既有 MCP Tools。
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={openCreateAgentServer}
              className="gap-1.5 h-10 px-5 rounded-xl border border-input/60 shadow-sm hover:bg-muted transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              新增 Remote MCP
            </Button>
          </div>

          {agentServers.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
              尚未設定任何 Agent Remote MCP
            </div>
          ) : (
            <div className="space-y-2">
              {agentServers.map((server) => {
                const enabled = server.config.enabled !== false
                const headerCount = Object.keys(server.config.headers || {}).length
                return (
                  <div
                    key={server.id}
                    className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-background hover:bg-muted/50 transition-colors shadow-sm"
                  >
                    <span className="text-muted-foreground shrink-0 text-lg">
                      <Satellite className="h-5 w-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{server.id}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {server.config.url}
                        {headerCount > 0 ? ` · ${headerCount} headers` : ""}
                        {server.config.timeout ? ` · ${server.config.timeout} ms` : ""}
                        {server.config.oauth === false ? " · oauth off" : ""}
                      </p>
                    </div>

                    <button
                      onClick={() => handleAgentToggle(server)}
                      disabled={isPending}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors shrink-0 font-medium ${
                        enabled
                          ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                          : "bg-muted text-muted-foreground border-border/50"
                      }`}
                    >
                      {enabled ? "啟用" : "停用"}
                    </button>

                    <button
                      onClick={() => openEditAgentServer(server)}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted active:scale-95"
                      title="編輯"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => handleAgentDelete(server)}
                      disabled={isPending}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10 active:scale-95"
                      title="刪除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border/70 pt-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">MCP 工具</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                現有 OpenAPI 工具鏈，維持原本使用方式。
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={openCreateTool}
              className="gap-1.5 h-10 px-5 rounded-xl border border-input/60 shadow-sm hover:bg-muted transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              新增工具
            </Button>
          </div>

          {tools.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
              尚未新增任何 MCP 工具
            </div>
          ) : (
            <div className="space-y-2">
              {tools.map((tool) => {
                const info = getInfo(tool)
                return (
                  <div
                    key={tool.id}
                    className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-background hover:bg-muted/50 transition-colors shadow-sm"
                  >
                    <span className="text-muted-foreground shrink-0 text-lg">🔗</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{info.name || tool.url}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {tool.url}/{tool.path}
                        {info.description ? ` · ${info.description}` : ""}
                      </p>
                    </div>

                    <button
                      onClick={() => handleToggle(tool)}
                      disabled={isPending}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors shrink-0 font-medium ${
                        tool.isActive
                          ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                          : "bg-muted text-muted-foreground border-border/50"
                      }`}
                    >
                      {tool.isActive ? "啟用" : "停用"}
                    </button>

                    <button
                      onClick={() => openEditTool(tool)}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted active:scale-95"
                      title="編輯"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(tool)}
                      disabled={isPending}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10 active:scale-95"
                      title="刪除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <AgentMcpDialog
        open={agentDialogOpen}
        onOpenChange={setAgentDialogOpen}
        initialData={editingAgentInitial}
        onSave={handleAgentSave}
      />

      <AgentSkillDialog
        open={agentSkillDialogOpen}
        onOpenChange={setAgentSkillDialogOpen}
        initialData={editingAgentSkillInitial}
        onSave={handleAgentSkillSave}
      />

      <McpToolDialog
        open={toolDialogOpen}
        onOpenChange={setToolDialogOpen}
        initialData={editingToolInitial}
        onSave={handleToolSave}
      />
    </>
  )
}
