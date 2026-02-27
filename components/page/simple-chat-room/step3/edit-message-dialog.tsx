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

interface EditMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentContent: string
  onSave: (newContent: string) => void
}

export const EditMessageDialog = ({ open, onOpenChange, currentContent, onSave }: EditMessageDialogProps) => {
  const [content, setContent] = useState(currentContent)

  useEffect(() => {
    setContent(currentContent)
  }, [currentContent])

  const handleSave = () => {
    onSave(content)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>編輯訊息</DialogTitle>
          <DialogDescription>修改這則訊息的內容。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="輸入訊息內容..."
            className="min-h-[150px] resize-none"
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
