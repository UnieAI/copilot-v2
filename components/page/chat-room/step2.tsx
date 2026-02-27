
import type { ChatroomPromptSettings } from "@/utils/chat-room/type"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    Settings,
    ArrowRight,
    ArrowLeft,
} from "lucide-react"

interface Props {
    promptSettings: ChatroomPromptSettings;
    setPromptSettings: React.Dispatch<React.SetStateAction<ChatroomPromptSettings>>;
    setStep: React.Dispatch<React.SetStateAction<number>>;
    startConversation:() => void;
}

export const Step2 = ({
    promptSettings,
    setPromptSettings,
    setStep,
    startConversation,
}: Props) => {

    return (
        <Card className="bg-zinc-50 dark:bg-zinc-950 shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    設定對話場景
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="scene">場景描述</Label>
                        <Input
                            id="scene"
                            placeholder="例：在未來都市的一家咖啡館"
                            value={promptSettings.scene}
                            onChange={(e) => setPromptSettings({ ...promptSettings, scene: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="topic">對話主題</Label>
                        <Input
                            id="topic"
                            placeholder="例：AI與人類共存"
                            value={promptSettings.topic}
                            onChange={(e) => setPromptSettings({ ...promptSettings, topic: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="tone">語氣風格</Label>
                        <Input
                            id="tone"
                            placeholder="例：輕鬆幽默"
                            value={promptSettings.tone}
                            onChange={(e) => setPromptSettings({ ...promptSettings, tone: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="objective">對話目標</Label>
                        <Input
                            id="objective"
                            placeholder="例：達成共識"
                            value={promptSettings.objective}
                            onChange={(e) => setPromptSettings({ ...promptSettings, objective: e.target.value })}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="style">詳細描述</Label>
                    <Textarea
                        id="style"
                        placeholder="例：每個角色都要保持自己的特色，對話要自然流暢..."
                        value={promptSettings.style}
                        onChange={(e) => setPromptSettings({ ...promptSettings, style: e.target.value })}
                    />
                </div>

                <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(1)} className="hover:bg-blue-500 hover:border-blue-700">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        上一步
                    </Button>
                    <Button variant="outline" onClick={startConversation} className="hover:bg-blue-500 hover:border-blue-700">
                        開始對話
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
