"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MessageCircle, Settings, Save, Download, Trash2, Plus, Upload } from "lucide-react"
import {
  ActionGetSystemPromptTemplates,
  ActionGetSystemPromptTemplateById,
  ActionCreateSystemPromptTemplate,
  ActionUpdateSystemPromptTemplate,
  ActionDeleteSystemPromptTemplate
} from "@/app/(main)/actions"
import { SystemPromptTemplate } from "../../../../lib/db/schema"
import { Session } from "next-auth"
import { CreateTemplateDialog } from "./create-template-dialog"

interface Step1Props {
  session: Session
  systemPrompt: string
  setSystemPrompt: (prompt: string) => void
  onNext: (importedMessages?: any[]) => void
}

export const Step1 = ({ session, systemPrompt, setSystemPrompt, onNext }: Step1Props) => {
  const [templates, setTemplates] = useState<SystemPromptTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [templateName, setTemplateName] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasContent = systemPrompt.trim().length > 0
  const hasSelectedTemplate = !!selectedTemplateId

  const loadTemplates = async () => {
    try {
      const datas = await ActionGetSystemPromptTemplates({ userId: session.user.id });
      setTemplates(datas)
    } catch (error) {
      console.error("載入範本失敗:", error)
    }
  }

  const loadTemplate = async (templateId: string) => {
    if (!templateId) return

    try {
      const data = await ActionGetSystemPromptTemplateById({
        id: selectedTemplateId
      });
      if (data) {
        setSystemPrompt(data.content)
        setTemplateName(data.name)
      }
    } catch (error) {
      console.error("載入範本失敗:", error)
    }
  }

  const saveTemplate = async () => {
    if (!templateName.trim() || !systemPrompt.trim()) {
      alert("請填寫範本名稱和內容！")
      return
    }

    setIsLoading(true)
    try {
      const result = await ActionCreateSystemPromptTemplate({
        userId: session.user.id,
        name: templateName.trim(),
        content: systemPrompt.trim()
      });

      if (result.id) {
        alert("範本儲存成功！")
        setShowCreateDialog(false)
        setTemplateName("")
        loadTemplates()
      }
    } catch (error) {
      console.error("儲存範本失敗:", error)
      alert("儲存範本失敗！")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateTemplate = async () => {
    if (!selectedTemplateId || !templateName.trim() || !systemPrompt.trim()) return
    setIsLoading(true)
    try {
      await ActionUpdateSystemPromptTemplate({
        id: selectedTemplateId,
        name: templateName.trim(),
        content: systemPrompt.trim(),
      })
      alert("範本更新成功！")
      loadTemplates()
    } catch (error) {
      console.error("更新失敗", error)
      alert("更新範本失敗")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return
    if (!confirm("確定要刪除此範本嗎？")) return

    setIsLoading(true)
    try {
      await ActionDeleteSystemPromptTemplate({ id: selectedTemplateId })
      alert("範本刪除成功！")
      setSelectedTemplateId("")
      setTemplateName("")
      setSystemPrompt("")
      loadTemplates()
    } catch (error) {
      console.error("刪除失敗", error)
      alert("刪除範本失敗")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== "application/json") {
      alert("請選擇 JSON 檔案！")
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)

        if (data.systemPrompt && Array.isArray(data.messages)) {
          setSystemPrompt(data.systemPrompt)
          onNext(data.messages)
        } else {
          alert("JSON 檔案格式不正確！請確保包含 systemPrompt 和 messages 欄位。")
        }
      } catch (error) {
        console.error("解析 JSON 檔案失敗:", error)
        alert("解析 JSON 檔案失敗！請檢查檔案格式。")
      }
    }
    reader.readAsText(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const startChat = (importedMessages?: any[]) => {
    // if (!systemPrompt.trim()) {
    //   alert("請填寫 System Prompt！")
    //   return
    // }
    onNext(importedMessages)
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  useEffect(() => {
    if (selectedTemplateId) {
      loadTemplate(selectedTemplateId)
    }
  }, [selectedTemplateId])

  return (
    <div className="w-full mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <MessageCircle className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Simple AI Chat</h1>
        </div>
        <p className="text-zinc-500">設定 System Prompt 開始聊天</p>
      </div>

      {/* JSON Import Section */}
      <Card className="bg-zinc-50 dark:bg-zinc-950 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            匯入對話記錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="json-import">選擇 JSON 檔案</Label>
            <div className="flex gap-2">
              <Input ref={fileInputRef} type="file" accept=".json" onChange={handleFileImport} className="flex-1" />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-1" />
                瀏覽
              </Button>
            </div>
            <p className="text-sm text-zinc-500">匯入之前匯出的對話記錄，將自動載入 System Prompt 並進入聊天室</p>
          </div>
        </CardContent>
      </Card>

      {/* Template Management */}
      <Card className="bg-zinc-50 dark:bg-zinc-950 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            範本管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="template-select">選擇範本</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇一個範本..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 flex-wrap items-end">
              {/* 只有選擇了範本才顯示 更新 / 刪除 */}
              {hasSelectedTemplate && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleUpdateTemplate}
                    disabled={isLoading || !systemPrompt.trim()}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    更新
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={handleDeleteTemplate}
                    disabled={isLoading}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    刪除
                  </Button>
                </>
              )}

              {/* 沒有選擇範本，但有內容 → 顯示儲存新範本 */}
              {!hasSelectedTemplate && hasContent && (
                <Button
                  variant="default"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  儲存為新範本
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Form */}
      <Card className="bg-zinc-50 dark:bg-zinc-950 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            設定 System Prompt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="system-prompt">System Prompt</Label>
            <Textarea
              id="system-prompt"
              placeholder="例：你是一個友善的AI助手，請用繁體中文回答問題..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
          <div className="flex justify-between">
            <Button onClick={() => startChat()} className="text-white bg-blue-600 hover:bg-blue-700">
              開始聊天
            </Button>
          </div>
        </CardContent>
      </Card>

      <CreateTemplateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        currentContent={systemPrompt}
        userId={session.user.id}
        onSuccess={() => {
          loadTemplates()
          setShowCreateDialog(false)
        }}
      />
    </div>
  )
}
