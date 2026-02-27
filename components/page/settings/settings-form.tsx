"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Settings, Server, Key, Cpu, CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react"
import { cn } from "../../../lib/utils"

import { Model, ApiSettings } from "@/utils/settings/type"
import { ActionGetUserApiSettings, ActionSaveUserApiSettings } from "@/app/(main)/actions"
import { Session } from "next-auth"

export const SettingsForm = ({
    session
}: {
    session: Session
}) => {
    const [settings, setSettings] = useState<ApiSettings>({
        apiUrl: "",
        apiKey: "",
        selectedModel: "",
    })
    const [models, setModels] = useState<Model[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isTestingConnection, setIsTestingConnection] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle")
    const [errorMessage, setErrorMessage] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle")

    // 載入已保存的設定
    useEffect(() => {
        if (!session?.user.id) return;

        (async () => {
            try {
                const data = await ActionGetUserApiSettings(session.user.id);
                if (data) {
                    setSettings(data);
                    if (data.apiUrl && data.apiKey) {
                        testConnection(data.apiUrl, data.apiKey);
                    }
                }
            } catch (err) {
                console.error("載入 API 設定失敗", err);
            }
        })();
    }, [session?.user.id]);

    const testConnection = async (url?: string, key?: string) => {
        const apiUrl = url || settings.apiUrl
        const apiKey = key || settings.apiKey

        if (!apiUrl || !apiKey) {
            setErrorMessage("請輸入 API URL 和 API Key")
            setConnectionStatus("error")
            return
        }

        setIsTestingConnection(true)
        setConnectionStatus("idle")
        setErrorMessage("")

        try {
            const response = await fetch("/api/v1/models", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    apiUrl: apiUrl.replace(/\/$/, ""), // 移除末尾的斜線
                    apiKey,
                }),
            })

            const data = await response.json()

            if (response.ok) {
                setModels(data.models || [])
                setConnectionStatus("success")
                setErrorMessage("")
            } else {
                setConnectionStatus("error")
                setErrorMessage(data.error || "連接失敗")
                setModels([])
            }
        } catch (error) {
            setConnectionStatus("error")
            setErrorMessage("網路錯誤，請檢查網路連接")
            setModels([])
        } finally {
            setIsTestingConnection(false)
        }
    }

    const handleSaveSettings = async () => {
        if (!session?.user.id) {
            // 可顯示 toast 或 alert「請先登入」
            setSaveStatus("error");
            setErrorMessage("請先登入");
            return;
        }

        if (!settings.apiUrl || !settings.apiKey) {
            setSaveStatus("error");
            return;
        }

        setIsSaving(true);
        setSaveStatus("idle");

        try {
            const result = await ActionSaveUserApiSettings(session?.user.id, settings);
            if (result.success) {
                setSaveStatus("success");
                setTimeout(() => setSaveStatus("idle"), 3000);
            } else {
                setSaveStatus("error");
                setErrorMessage(result.message || "儲存失敗");
            }
        } catch (err) {
            setSaveStatus("error");
            setErrorMessage("伺服器錯誤");
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (field: keyof ApiSettings, value: string) => {
        setSettings((prev) => ({
            ...prev,
            [field]: value,
        }))

        // 當 URL 或 Key 改變時，重置連接狀態
        if (field === "apiUrl" || field === "apiKey") {
            setConnectionStatus("idle")
            setModels([])
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500 rounded-lg">
                    <Settings className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">API 設定</h1>
                    <p className="text-muted-foreground">配置你的 AI 模型 API 連接</p>
                </div>
            </div>

            <div className="grid gap-6 max-w-2xl">
                {/* API 連接設定 */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Server className="w-5 h-5" />
                            API 連接設定
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="apiUrl" className="flex items-center gap-2">
                                <Server className="w-4 h-4" />
                                API URL
                            </Label>
                            <Input
                                id="apiUrl"
                                placeholder="https://api.example.com"
                                value={settings.apiUrl}
                                onChange={(e) => handleInputChange("apiUrl", e.target.value)}
                                className="font-mono"
                            />
                            <p className="text-xs text-muted-foreground">輸入你的 AI API 基礎 URL（不包含 /v1/models 或其他路徑）</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="apiKey" className="flex items-center gap-2">
                                <Key className="w-4 h-4" />
                                API Key
                            </Label>
                            <Input
                                id="apiKey"
                                type="password"
                                placeholder="sk-..."
                                value={settings.apiKey}
                                onChange={(e) => handleInputChange("apiKey", e.target.value)}
                                className="font-mono"
                            />
                            <p className="text-xs text-muted-foreground">你的 API 金鑰，將會安全地保存在本地</p>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={() => testConnection()}
                                disabled={isTestingConnection || !settings.apiUrl || !settings.apiKey}
                                className="flex items-center gap-2"
                            >
                                {isTestingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                測試連接
                            </Button>

                            {connectionStatus !== "idle" && (
                                <div className="flex items-center gap-2">
                                    {connectionStatus === "success" ? (
                                        <Badge variant="default" className="bg-green-500">
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                            連接成功
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive">
                                            <XCircle className="w-3 h-3 mr-1" />
                                            連接失敗
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </div>

                        {errorMessage && (
                            <Alert variant="destructive">
                                <XCircle className="h-4 w-4" />
                                <AlertDescription>{errorMessage}</AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {/* 模型選擇 */}
                {models.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Cpu className="w-5 h-5" />
                                模型選擇
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="model">選擇模型</Label>
                                <Select
                                    value={settings.selectedModel}
                                    onValueChange={(value) => handleInputChange("selectedModel", value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="選擇一個模型..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {models.map((model) => (
                                            <SelectItem key={model.id} value={model.id}>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{model.id}</span>
                                                    {model.owned_by && <span className="text-xs text-muted-foreground">by {model.owned_by}</span>}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">找到 {models.length} 個可用模型</p>
                            </div>

                            {/* 模型列表預覽 */}
                            <div className="space-y-2">
                                <Label>可用模型列表</Label>
                                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                                    {models.map((model) => (
                                        <div
                                            key={model.id}
                                            className={cn(
                                                "flex items-center justify-between p-2 rounded text-sm",
                                                settings.selectedModel === model.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                                            )}
                                        >
                                            <span className="font-mono">{model.id}</span>
                                            {model.owned_by && (
                                                <Badge variant="outline" className="text-xs">
                                                    {model.owned_by}
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* 保存設定 */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-medium">保存設定</h3>
                                <p className="text-sm text-muted-foreground">設定將保存在DB中</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {saveStatus === "success" && (
                                    <Badge variant="default" className="bg-green-500">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        已保存
                                    </Badge>
                                )}
                                {saveStatus === "error" && (
                                    <Badge variant="destructive">
                                        <XCircle className="w-3 h-3 mr-1" />
                                        保存失敗
                                    </Badge>
                                )}
                                <Button
                                    onClick={handleSaveSettings}
                                    disabled={isSaving || !settings.apiUrl || !settings.apiKey}
                                    className="flex items-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    保存設定
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 當前設定摘要 */}
                {settings.apiUrl && settings.apiKey && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">當前設定摘要</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">API URL:</span>
                                <code className="text-sm bg-muted px-2 py-1 rounded">{settings.apiUrl}</code>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">API Key:</span>
                                <code className="text-sm bg-muted px-2 py-1 rounded">{settings.apiKey.substring(0, 8)}...</code>
                            </div>
                            {settings.selectedModel && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">選擇的模型:</span>
                                    <Badge variant="outline">{settings.selectedModel}</Badge>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">連接狀態:</span>
                                {connectionStatus === "success" ? (
                                    <Badge variant="default" className="bg-green-500">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        已連接
                                    </Badge>
                                ) : connectionStatus === "error" ? (
                                    <Badge variant="destructive">
                                        <XCircle className="w-3 h-3 mr-1" />
                                        連接失敗
                                    </Badge>
                                ) : (
                                    <Badge variant="outline">未測試</Badge>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
