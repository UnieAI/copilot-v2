"use client"

import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export type AgentSkillFormData = {
  name: string
  description: string
  content: string
  isEnabled: boolean
}

interface AgentSkillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: AgentSkillFormData & { id: string }
  onSave: (data: AgentSkillFormData, id?: string) => Promise<void>
}

const emptyForm: AgentSkillFormData = {
  name: "",
  description: "",
  content: "",
  isEnabled: true,
}

export function AgentSkillDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
}: AgentSkillDialogProps) {
  const isCreating = !initialData
  const [formData, setFormData] = useState<AgentSkillFormData>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [nameError, setNameError] = useState("")
  const [touchedName, setTouchedName] = useState(false)

  useEffect(() => {
    if (!open) return

    setFormData(initialData ? {
      name: initialData.name,
      description: initialData.description,
      content: initialData.content,
      isEnabled: initialData.isEnabled,
    } : emptyForm)
    setNameError("")
    setTouchedName(false)
  }, [open, initialData])

  const validate = () => {
    const nextName = formData.name.trim()
    setTouchedName(true)
    if (!nextName) {
      setNameError("請輸入 Skill 名稱")
      return false
    }
    setNameError("")
    return true
  }

  const handleSave = async () => {
    if (!validate()) return

    setIsSaving(true)
    try {
      await onSave(
        {
          name: formData.name.trim(),
          description: formData.description.trim(),
          content: formData.content.trim(),
          isEnabled: formData.isEnabled,
        },
        initialData?.id,
      )
      onOpenChange(false)
      toast.success(isCreating ? "Agent Skill 已新增" : "Agent Skill 已更新")
    } catch {
      toast.error("儲存失敗，請稍後再試")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? "新增 Agent Skill" : `編輯 Agent Skill - ${initialData?.name}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Skill 基本資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Skill 名稱</Label>
                <Input
                  value={formData.name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="docs-writer"
                  className={cn(
                    touchedName && nameError && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  會自動轉成資料夾名稱與 frontmatter `name`，建議使用英文、數字、`-`、`_`。
                </p>
                {touchedName && nameError && (
                  <p className="text-xs text-destructive">{nameError}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>描述</Label>
                <Textarea
                  value={formData.description}
                  onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                  rows={2}
                  placeholder="描述這個 skill 何時該被 agent 使用"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
                <div>
                  <p className="text-sm font-medium">啟用</p>
                  <p className="text-xs text-muted-foreground">停用後仍會保留於資料庫，但不會在 Agent 啟動時匯入。</p>
                </div>
                <Switch
                  checked={formData.isEnabled}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isEnabled: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">SKILL.md 內容</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={formData.content}
                onChange={(event) => setFormData((prev) => ({ ...prev, content: event.target.value }))}
                rows={16}
                placeholder={"# Role\n\nDescribe the behavior, workflow, and constraints for this skill."}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                系統會自動補上 YAML frontmatter，只需要填寫正文內容。
              </p>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900">
            啟用 Agent mode 時，系統會把已啟用的 skills 寫入 sandbox 的 opencode skills 目錄。若 sandbox 已在執行，請重啟後套用。
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              {isSaving ? "儲存中..." : isCreating ? "新增 Skill" : "儲存變更"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
