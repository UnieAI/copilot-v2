"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { fetchVerify } from "@/lib/mcp/fetch-verify"

export interface McpFormData {
    name: string
    description: string
    url: string
    apiKey: string
    path: string
}

interface McpToolDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** undefined = create mode, defined = edit mode */
    initialData?: McpFormData & { id: string }
    onSave: (data: McpFormData, id?: string) => Promise<void>
}

const emptyForm: McpFormData = { name: "", description: "", url: "", apiKey: "", path: "openapi.json" }

export function McpToolDialog({ open, onOpenChange, initialData, onSave }: McpToolDialogProps) {
    const isCreating = !initialData

    const [formData, setFormData] = useState<McpFormData>(emptyForm)
    const [isSaving, setIsSaving] = useState(false)
    const [isVerifying, setIsVerifying] = useState(false)

    // Validation
    const [urlError, setUrlError] = useState<string>("")
    const [nameError, setNameError] = useState<string>("")
    const [touchedUrl, setTouchedUrl] = useState(false)
    const [touchedName, setTouchedName] = useState(false)

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            setFormData(initialData ? {
                name: initialData.name,
                description: initialData.description,
                url: initialData.url,
                apiKey: initialData.apiKey,
                path: initialData.path,
            } : emptyForm)
            setUrlError("")
            setNameError("")
            setTouchedUrl(false)
            setTouchedName(false)
        }
    }, [open, initialData])

    const validate = () => {
        let valid = true
        if (!formData.url.trim()) { setUrlError("請輸入 URL"); valid = false } else setUrlError("")
        if (!formData.name.trim()) { setNameError("請輸入工具名稱"); valid = false } else setNameError("")
        setTouchedUrl(true)
        setTouchedName(true)
        return valid
    }

    const handleSave = async () => {
        if (!validate()) return
        setIsSaving(true)
        try {
            await onSave(formData, initialData?.id)
            onOpenChange(false)
            toast.success(isCreating ? "MCP 工具已新增" : "MCP 工具已更新")
        } catch {
            toast.error("儲存失敗，請稍後再試")
        } finally {
            setIsSaving(false)
        }
    }

    const handleVerify = async () => {
        if (!formData.url.trim()) { setUrlError("請輸入 URL"); setTouchedUrl(true); return }
        setIsVerifying(true)
        const ok = await fetchVerify(formData.apiKey, `${formData.url.replace(/\/+$/, "")}/${formData.path}`)
        setIsVerifying(false)
        if (ok) toast.success("MCP 工具連線成功 ✓")
        else toast.error("MCP 工具連線失敗 — 請確認 URL 和 Key 是否正確")
    }

    const set = (key: keyof McpFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setFormData(prev => ({ ...prev, [key]: e.target.value }))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isCreating ? "新增 MCP 工具" : `編輯 MCP 工具 — ${initialData?.name}`}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    {/* Info Card */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">基本資訊</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>名稱 <span className="text-destructive">*</span></Label>
                                <Input
                                    value={formData.name}
                                    onChange={set("name")}
                                    placeholder="輸入工具名稱..."
                                    className={cn(
                                        touchedName && nameError && "border-destructive focus-visible:ring-destructive"
                                    )}
                                />
                                {touchedName && nameError && (
                                    <p className="text-xs text-destructive">{nameError}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label>描述</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={set("description")}
                                    placeholder="描述此工具的用途，LLM 將根據此資訊決定是否調用..."
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* API Card */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">API 設定</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>Base URL <span className="text-destructive">*</span></Label>
                                <Input
                                    value={formData.url}
                                    onChange={set("url")}
                                    placeholder="https://api.example.com"
                                    type="url"
                                    className={cn(
                                        touchedUrl && urlError && "border-destructive focus-visible:ring-destructive"
                                    )}
                                />
                                {touchedUrl && urlError && (
                                    <p className="text-xs text-destructive">{urlError}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label>API Key</Label>
                                <Input
                                    value={formData.apiKey}
                                    onChange={set("apiKey")}
                                    placeholder="輸入 API Key（選填）"
                                    type="password"
                                    autoComplete="new-password"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label>OpenAPI 規範路徑</Label>
                                <Input
                                    value={formData.path}
                                    onChange={set("path")}
                                    placeholder="openapi.json"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Copilot 將向{" "}
                                    <code className="bg-muted px-1 rounded text-[11px]">
                                        {formData.url.replace(/\/+$/, "") || "https://..."}/{formData.path || "openapi.json"}
                                    </code>{" "}
                                    取得工具規範
                                </p>
                            </div>

                            {/* Test Connection */}
                            <div className="flex items-center justify-between pt-1 border-t border-border">
                                <span className="text-sm text-muted-foreground">測試連線</span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleVerify}
                                    disabled={isVerifying}
                                    className="gap-2"
                                >
                                    <RefreshCw className={cn("h-3.5 w-3.5", isVerifying && "animate-spin")} />
                                    {isVerifying ? "連線中..." : "測試"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                            取消
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "儲存中..." : isCreating ? "新增工具" : "儲存變更"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
