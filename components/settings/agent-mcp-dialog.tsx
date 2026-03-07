"use client"

import { useEffect, useState } from "react"
import { RefreshCw, Plus, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export type AgentMcpHeaderField = {
  key: string
  value: string
}

export type AgentMcpFormData = {
  id: string
  url: string
  enabled: boolean
  timeoutMs: string
  disableOauth: boolean
  headers: AgentMcpHeaderField[]
}

interface AgentMcpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: AgentMcpFormData & { previousId: string }
  onSave: (data: AgentMcpFormData, previousId?: string) => Promise<void>
}

const emptyForm: AgentMcpFormData = {
  id: "",
  url: "",
  enabled: true,
  timeoutMs: "",
  disableOauth: false,
  headers: [{ key: "", value: "" }],
}

export function AgentMcpDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
}: AgentMcpDialogProps) {
  const isCreating = !initialData
  const [formData, setFormData] = useState<AgentMcpFormData>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [serverIdError, setServerIdError] = useState("")
  const [urlError, setUrlError] = useState("")
  const [touched, setTouched] = useState({ id: false, url: false })

  useEffect(() => {
    if (!open) return

    setFormData(initialData ? {
      id: initialData.id,
      url: initialData.url,
      enabled: initialData.enabled,
      timeoutMs: initialData.timeoutMs,
      disableOauth: initialData.disableOauth,
      headers: initialData.headers.length > 0 ? initialData.headers : [{ key: "", value: "" }],
    } : emptyForm)
    setServerIdError("")
    setUrlError("")
    setTouched({ id: false, url: false })
  }, [open, initialData])

  const updateHeader = (index: number, field: keyof AgentMcpHeaderField, value: string) => {
    setFormData((prev) => ({
      ...prev,
      headers: prev.headers.map((header, headerIndex) =>
        headerIndex === index ? { ...header, [field]: value } : header
      ),
    }))
  }

  const addHeader = () => {
    setFormData((prev) => ({
      ...prev,
      headers: [...prev.headers, { key: "", value: "" }],
    }))
  }

  const removeHeader = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      headers: prev.headers.filter((_, headerIndex) => headerIndex !== index),
    }))
  }

  const validate = () => {
    let valid = true
    const id = formData.id.trim()
    const url = formData.url.trim()

    if (!id) {
      setServerIdError("請輸入 Server ID")
      valid = false
    } else {
      setServerIdError("")
    }

    if (!url) {
      setUrlError("請輸入 MCP URL")
      valid = false
    } else {
      setUrlError("")
    }

    setTouched({ id: true, url: true })
    return valid
  }

  const handleSave = async () => {
    if (!validate()) return

    setIsSaving(true)
    try {
      await onSave(
        {
          ...formData,
          id: formData.id.trim(),
          url: formData.url.trim(),
          timeoutMs: formData.timeoutMs.trim(),
          headers: formData.headers.map((header) => ({
            key: header.key.trim(),
            value: header.value.trim(),
          })),
        },
        initialData?.previousId,
      )
      onOpenChange(false)
      toast.success(isCreating ? "Agent MCP 已新增" : "Agent MCP 已更新")
    } catch {
      toast.error("儲存失敗，請稍後再試")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? "新增 Agent Remote MCP" : `編輯 Agent Remote MCP - ${initialData?.id}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Server 設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Server ID</Label>
                <Input
                  value={formData.id}
                  onChange={(event) => setFormData((prev) => ({ ...prev, id: event.target.value }))}
                  placeholder="github"
                  className={cn(touched.id && serverIdError && "border-destructive focus-visible:ring-destructive")}
                />
                <p className="text-xs text-muted-foreground">
                  對應 opencode `mcp.&lt;serverId&gt;` 的 key，建議使用簡短英文識別碼。
                </p>
                {touched.id && serverIdError && (
                  <p className="text-xs text-destructive">{serverIdError}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Remote URL</Label>
                <Input
                  value={formData.url}
                  onChange={(event) => setFormData((prev) => ({ ...prev, url: event.target.value }))}
                  placeholder="https://example.com/mcp"
                  className={cn(touched.url && urlError && "border-destructive focus-visible:ring-destructive")}
                />
                {touched.url && urlError && (
                  <p className="text-xs text-destructive">{urlError}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Timeout (ms)</Label>
                  <Input
                    value={formData.timeoutMs}
                    onChange={(event) => setFormData((prev) => ({ ...prev, timeoutMs: event.target.value }))}
                    inputMode="numeric"
                    placeholder="30000"
                  />
                  <p className="text-xs text-muted-foreground">留空代表使用 opencode 預設值。</p>
                </div>

                <div className="space-y-3 rounded-xl border border-border/60 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">啟用</p>
                      <p className="text-xs text-muted-foreground">關閉後會保留設定，但不會注入 sandbox。</p>
                    </div>
                    <Switch
                      checked={formData.enabled}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, enabled: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">停用 OAuth 自動流程</p>
                      <p className="text-xs text-muted-foreground">若以 headers/API key 驗證，建議開啟。</p>
                    </div>
                    <Switch
                      checked={formData.disableOauth}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, disableOauth: checked }))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-medium">Headers</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addHeader} className="gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  新增 Header
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {formData.headers.map((header, index) => (
                <div key={`header-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <Input
                    value={header.key}
                    onChange={(event) => updateHeader(index, "key", event.target.value)}
                    placeholder="Authorization"
                  />
                  <Input
                    value={header.value}
                    onChange={(event) => updateHeader(index, "value", event.target.value)}
                    placeholder="Bearer ..."
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeHeader(index)}
                    disabled={formData.headers.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                會直接寫入 opencode 的 `mcp.&lt;serverId&gt;.headers`。
              </p>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900">
            設定會在下次 Agent sandbox 啟動時注入。若 sandbox 已經在執行，請重啟後套用最新 MCP。
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              {isSaving ? "儲存中..." : isCreating ? "新增 Remote MCP" : "儲存變更"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
