"use client"

import { useState, useTransition } from "react"
import { McpToolDialog, type McpFormData } from "@/components/settings/mcp-tool-dialog"
import { actionAddMcpTool, actionUpdateMcpTool, actionDeleteMcpTool, actionToggleMcpTool } from "@/app/[locale]/(main)/settings/actions"
import type { McpTool } from "@/lib/db/schema"
import { toast } from "sonner"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SettingsMcpSectionProps {
    initialTools: McpTool[]
}

export function SettingsMcpSection({ initialTools }: SettingsMcpSectionProps) {
    const [tools, setTools] = useState<McpTool[]>(initialTools)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingTool, setEditingTool] = useState<McpTool | null>(null)
    const [isPending, startTransition] = useTransition()

    const openCreate = () => { setEditingTool(null); setDialogOpen(true) }
    const openEdit = (tool: McpTool) => { setEditingTool(tool); setDialogOpen(true) }

    const getInfo = (tool: McpTool) => (tool.info as any) || {}

    const handleSave = async (data: McpFormData, id?: string) => {
        const payload = {
            url: data.url,
            path: data.path,
            key: data.apiKey,
            name: data.name,
            description: data.description,
        }
        if (id) {
            await actionUpdateMcpTool(id, payload)
            setTools(prev => prev.map(t => t.id === id ? {
                ...t,
                url: data.url,
                path: data.path,
                key: data.apiKey || null,
                info: { name: data.name, description: data.description }
            } : t))
        } else {
            await actionAddMcpTool(payload)
            window.location.reload()
        }
    }

    const handleDelete = (tool: McpTool) => {
        if (!confirm(`確定要刪除「${getInfo(tool).name || tool.url}」嗎？`)) return
        startTransition(async () => {
            try {
                await actionDeleteMcpTool(tool.id)
                setTools(prev => prev.filter(t => t.id !== tool.id))
                toast.success("已刪除 MCP 工具")
            } catch {
                toast.error("刪除失敗")
            }
        })
    }

    const handleToggle = (tool: McpTool) => {
        startTransition(async () => {
            try {
                await actionToggleMcpTool(tool.id, tool.isActive)
                setTools(prev => prev.map(t => t.id === tool.id ? { ...t, isActive: t.isActive === 1 ? 0 : 1 } : t))
            } catch {
                toast.error("切換失敗")
            }
        })
    }

    const editingInitial = editingTool ? {
        id: editingTool.id,
        name: getInfo(editingTool).name || "",
        description: getInfo(editingTool).description || "",
        url: editingTool.url,
        apiKey: editingTool.key || "",
        path: editingTool.path,
    } : undefined

    return (
        <>
            <section className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="font-semibold">MCP 工具</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">管理 AI 可調用的外部工具，規範透過 OpenAPI 自動取得</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={openCreate} className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        新增工具
                    </Button>
                </div>

                {tools.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                        尚未新增任何 MCP 工具
                    </div>
                ) : (
                    <div className="space-y-2">
                        {tools.map(tool => {
                            const info = getInfo(tool)
                            return (
                                <div key={tool.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                                    <span className="text-muted-foreground shrink-0 text-sm">🔗</span>
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
                                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors shrink-0 ${tool.isActive
                                            ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                                            : "bg-muted text-muted-foreground border-border"
                                            }`}
                                    >
                                        {tool.isActive ? "啟用" : "停用"}
                                    </button>

                                    <button
                                        onClick={() => openEdit(tool)}
                                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted"
                                        title="編輯"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>

                                    <button
                                        onClick={() => handleDelete(tool)}
                                        disabled={isPending}
                                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded hover:bg-muted"
                                        title="刪除"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            <McpToolDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                initialData={editingInitial}
                onSave={handleSave}
            />
        </>
    )
}
