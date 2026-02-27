"use client"

import React, { useState } from "react"

import type { Message } from "@/utils/llm/type"
import type { CharacterChatType, ChatroomPromptSettings, ChatMessage } from "@/utils/chat-room/type"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Play, Pause, Loader2, Send, User, Download } from "lucide-react"

import type { ParsedContent } from "@/utils/llm/type"
import { parseContent } from "@/utils/llm/functions"

import { MessageRender } from "./step3/message-render"
import { UserInput } from "./step3/user-input"

interface Props {
  isPlaying: boolean
  isGenerating: boolean
  isWaitingForUser: boolean
  pauseConversation: () => void
  resumeConversation: () => void
  restartConversation: () => void
  currentSpeaker: string
  selectedCharacters: CharacterChatType[]
  allMessages: ChatMessage[]
  userCharacter: CharacterChatType | null
  userInput: string
  setUserInput: React.Dispatch<React.SetStateAction<string>>
  promptSettings: ChatroomPromptSettings
  setChatMap: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>
  setAllMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  setIsWaitingForUser: React.Dispatch<React.SetStateAction<boolean>>
  setCurrentSpeaker: React.Dispatch<React.SetStateAction<string>>
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>
  isAutoScrolling: boolean;
  setIsAutoScrolling: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Step3 = ({
  isPlaying,
  isGenerating,
  isWaitingForUser,
  pauseConversation,
  resumeConversation,
  restartConversation,
  currentSpeaker,
  selectedCharacters,
  allMessages,
  userCharacter,
  userInput,
  setUserInput,
  promptSettings,
  setChatMap,
  setAllMessages,
  setIsWaitingForUser,
  setCurrentSpeaker,
  setActiveIndex,
  isAutoScrolling,
  setIsAutoScrolling,
}: Props) => {

  const downloadConversation = () => {
    if (allMessages.length === 0) {
      alert("沒有對話內容可以下載")
      return
    }

    // 生成檔名
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19) // 格式: 2024-01-15T14-30-45
    const filename = `${timestamp}-multi-ai-chatroom.txt`

    // 格式化對話內容
    let content = "=".repeat(50) + "\n"
    content += "Multi AI Chatroom 對話記錄\n"
    content += "=".repeat(50) + "\n"
    content += `導出時間: ${now.toLocaleString("zh-TW")}\n`
    content += `參與角色: ${selectedCharacters.map((c) => c.CharacterType.name).join("、")}\n`

    // 添加場景設定（如果有的話）
    if (
      promptSettings.scene ||
      promptSettings.topic ||
      promptSettings.tone ||
      promptSettings.objective ||
      promptSettings.style
    ) {
      content += "\n" + "-".repeat(30) + "\n"
      content += "場景設定:\n"
      content += "-".repeat(30) + "\n"
      if (promptSettings.scene) content += `場景: ${promptSettings.scene}\n`
      if (promptSettings.topic) content += `主題: ${promptSettings.topic}\n`
      if (promptSettings.tone) content += `語氣: ${promptSettings.tone}\n`
      if (promptSettings.objective) content += `目標: ${promptSettings.objective}\n`
      if (promptSettings.style) content += `風格: ${promptSettings.style}\n`
    }

    content += "\n" + "=".repeat(50) + "\n"
    content += "對話內容\n"
    content += "=".repeat(50) + "\n\n"

    // 添加對話內容
    allMessages.forEach((message, index) => {
      const time = message.timestamp.toLocaleTimeString("zh-TW", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })

      const speaker = message.isUser
        ? `${message.character.CharacterType.name} (使用者)`
        : message.character.CharacterType.name

      content += `[${time}] ${speaker}:\n`
      content += `${message.content}\n\n`
    })

    content += "=".repeat(50) + "\n"
    content += `總共 ${allMessages.length} 則訊息\n`
    content += "=".repeat(50) + "\n"

    // 創建並下載文件
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  };

  const handleUserSubmit = () => {
    if (!userInput.trim() || !userCharacter || !isWaitingForUser) return;

    const _pc: ParsedContent = parseContent(userInput.trim());

    // 添加用戶消息到 chatMap
    setChatMap((prev) => ({
      ...prev,
      [userCharacter.CharacterType.id!]: [
        ...prev[userCharacter.CharacterType.id!],
        { role: "assistant", content: _pc.content },
      ],
    }));

    // 添加用戶消息到聊天界面
    setAllMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        characterId: userCharacter.CharacterType.id!,
        character: userCharacter,
        content: _pc.content,
        reason: _pc.reason,
        timestamp: new Date(),
        isUser: true,
      },
    ]);

    // 清空輸入框並繼續下一個角色
    setUserInput("");
    setIsWaitingForUser(false);
    setCurrentSpeaker("");
    setActiveIndex((prev) => (prev + 1) % selectedCharacters.length);
    setIsAutoScrolling(true);
  };

  return (
    <div className="h-[88vh] flex flex-col">
      {/* 控制面板 - 固定在上方 */}
      <div className="flex-shrink-0">
        <Card className="bg-zinc-50 dark:bg-zinc-950 shadow-lg rounded border-b">
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  {isPlaying ? (
                    <Button variant="outline" onClick={pauseConversation}>
                      <Pause className="w-4 h-4 mr-2" />
                      暫停
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={resumeConversation} className="bg-green-500 hover:bg-green-700">
                      <Play className="w-4 h-4 mr-2" />
                      {isGenerating ? "生成中..." : isWaitingForUser ? "等待輸入..." : "繼續"}
                    </Button>
                  )}
                </div>
                {(isGenerating || isWaitingForUser) && (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                    {currentSpeaker &&
                      selectedCharacters.find((c) => c.CharacterType.id === currentSpeaker)?.CharacterType.name}
                    {isGenerating ? " 正在思考..." : " 等待輸入..."}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={downloadConversation}
                  disabled={allMessages.length === 0}
                  className="flex items-center gap-2 bg-transparent"
                >
                  <Download className="w-4 h-4" />
                  下載對話
                </Button>
                <Button variant="outline" onClick={restartConversation}>
                  重新開始
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 聊天區域 - 佔滿中間空間並可滾動 */}
      <MessageRender
        allMessages={allMessages}
        userCharacter={userCharacter}
        isAutoScrolling={isAutoScrolling}
        setIsAutoScrolling={setIsAutoScrolling}
      />

      {/* 用戶輸入區域 - 固定在下方 */}
      {userCharacter && (
        <UserInput
          isWaitingForUser={isWaitingForUser}
          userCharacter={userCharacter}
          userInput={userInput}
          setUserInput={setUserInput}
          handleUserSubmit={handleUserSubmit}
        />
      )}
    </div>
  )
}
