"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ActionCreateSystemPromptTemplate } from "@/app/(main)/actions"

interface CreateTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentContent: string
  userId: string
  onSuccess: () => void
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
  currentContent,
  userId,
  onSuccess,
}: CreateTemplateDialogProps) {
  const [name, setName] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !currentContent.trim()) {
      alert("請輸入範本名稱與內容")
      return
    }

    setIsSaving(true)
    try {
      await ActionCreateSystemPromptTemplate({
        userId,
        name: name.trim(),
        content: currentContent.trim(),
      })
      alert("範本儲存成功！")
      onSuccess()
      setName("")
    } catch (err) {
      console.error(err)
      alert("儲存失敗，請稍後再試")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>儲存為新範本</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">範本名稱</Label>
            <Input
              id="template-name"
              placeholder="例如：客服回覆範本、翻譯助手..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
            >
              {isSaving ? "儲存中..." : "儲存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}