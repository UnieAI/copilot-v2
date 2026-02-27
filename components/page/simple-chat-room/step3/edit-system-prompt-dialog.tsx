"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface EditSystemPromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPrompt: string
  onSave: (newPrompt: string) => void
}

export const EditSystemPromptDialog = ({ open, onOpenChange, currentPrompt, onSave }: EditSystemPromptDialogProps) => {
  const [prompt, setPrompt] = useState(currentPrompt)

  useEffect(() => {
    setPrompt(currentPrompt)
  }, [currentPrompt])

  const handleSave = () => {
    onSave(prompt)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>編輯 System Prompt</DialogTitle>
          <DialogDescription>修改系統提示詞，這將影響 AI 的回應風格和行為。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="輸入系統提示詞..."
            className="min-h-[200px] resize-none"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>儲存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
