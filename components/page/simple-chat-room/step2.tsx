"use client"

import { useState, useRef, useEffect } from "react"
import { v4 as uuidv4 } from 'uuid';
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageCircle, Send, User, ChevronDown, Download, Settings, Edit, X, RefreshCw } from "lucide-react"
import { cn } from "../../../lib/utils"
import { ReasoningBlock } from "../../shared/reasoning-block"
import { UserInput } from "../../shared/user-input"
import { EditSystemPromptDialog } from "./step3/edit-system-prompt-dialog"
import { EditMessageDialog } from "./step3/edit-message-dialog"

import type { Message } from "@/utils/llm/type"
import type { ChatMessage } from "@/utils/simple-chat-room/type"

import { parseContent } from "@/utils/llm/functions"
import { ActionGetUserApiSettings } from "@/app/(main)/actions";
import { Session } from "next-auth";
import { ApiSettings } from "@/utils/settings/type";
import { useRouter } from "next/navigation";

interface Step2Props {
  session: Session
  systemPrompt: string
  onRestart: () => void
  importedMessages?: any[]
}

export const Step2 = ({ session, systemPrompt: initialSystemPrompt, onRestart, importedMessages = [] }: Step2Props) => {
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt)
  const [messages, setMessages] = useState<Message[]>([{ role: "system", content: initialSystemPrompt }])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState<string>("")
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [showScrollToBottom, setShowScrollToBottom] = useState<boolean>(false)
  const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(false)

  const [showSystemPromptDialog, setShowSystemPromptDialog] = useState(false)
  const [showEditMessageDialog, setShowEditMessageDialog] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingMessageContent, setEditingMessageContent] = useState("")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const router = useRouter()
  const [settings, setSettings] = useState<ApiSettings>({
    apiUrl: "",
    apiKey: "",
    selectedModel: "",
  })

  useEffect(() => {
    (async () => {
      try {
        const apiData = await ActionGetUserApiSettings(session.user.id);
        if (apiData) {
          setSettings(apiData);
        } else {
          router.push('/settings')
        }
      } catch (err) {
        console.error("載入 API 設定失敗", err);
        router.push('/settings');
      }
    })();
  }, []);

  useEffect(() => {
    if (importedMessages && importedMessages.length > 0) {
      const convertedChatMessages: ChatMessage[] = importedMessages.map((msg, index) => ({
        id: `imported-${index}`,
        content: msg.content,
        reason: msg.reason || "",
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        isUser: msg.role === "user",
      }))

      const convertedMessages: Message[] = [
        { role: "system", content: initialSystemPrompt },
        ...importedMessages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
      ]

      setChatMessages(convertedChatMessages)
      setMessages(convertedMessages)
    }
  }, [importedMessages, initialSystemPrompt])

  const downloadConversation = () => {
    const conversationData = {
      systemPrompt,
      messages: chatMessages.map((msg) => ({
        role: msg.isUser ? "user" : "assistant",
        content: msg.content,
        reason: msg.reason,
        timestamp: msg.timestamp.toISOString(),
      })),
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(conversationData, null, 2)], {
      type: "application/json",
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `conversation_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleSystemPromptUpdate = (newPrompt: string) => {
    setSystemPrompt(newPrompt)
    setMessages((prev) => [{ role: "system", content: newPrompt }, ...prev.slice(1)])
  }

  const handleEditMessage = (_id: string, newContent: string) => {
    setChatMessages((prev) => prev.map((msg) => (msg.id === _id ? { ...msg, content: newContent } : msg)))

    // Update messages array for API calls
    const messageIndex = chatMessages.findIndex((msg) => msg.id === _id)
    if (messageIndex !== -1) {
      const newMessages = [...messages]
      const systemMessageCount = 1
      const actualIndex = systemMessageCount + messageIndex
      if (actualIndex < newMessages.length) {
        newMessages[actualIndex] = {
          ...newMessages[actualIndex],
          content: newContent,
        }
        setMessages(newMessages)
      }
    }
  }

  const handleDeleteLastMessage = () => {
    if (chatMessages.length === 0) return

    setChatMessages((prev) => prev.slice(0, -1))
    setMessages((prev) => prev.slice(0, -1))
  }

  const handleRegenerateLastMessage = async () => {
    if (chatMessages.length === 0 || isGenerating) return

    const lastMessage = chatMessages[chatMessages.length - 1]
    if (lastMessage.isUser) return // Can't regenerate user messages

    // Remove the last assistant message
    setChatMessages((prev) => prev.slice(0, -1))
    const newMessages = messages.slice(0, -1)
    setMessages(newMessages)

    // Regenerate response
    await generateResponse(newMessages)
  }

  const generateResponse = async (messagesToSend: Message[]) => {
    setIsGenerating(true)
    setIsAutoScrolling(true)

    // Add waiting message
    const _id = uuidv4();
    setChatMessages((prev) => [
      ...prev,
      {
        id: _id,
        content: "",
        reason: "",
        timestamp: new Date(),
        isUser: false,
        isWaiting: true,
      },
    ])

    try {
      abortControllerRef.current = new AbortController()

      const response = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messagesToSend,
          settings,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) throw new Error("API request failed")

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let content = ""
      let firstTokenReceived = false

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") break

              try {
                const parsed = JSON.parse(data)
                const delta = parsed.choices?.[0]?.delta?.content
                if (delta) {
                  content += delta
                  const parsedContent = parseContent(content)

                  if (!firstTokenReceived && content.trim().length > 0) {
                    firstTokenReceived = true
                    setChatMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === _id
                          ? { ...msg, content: parsedContent.content, reason: parsedContent.reason, isWaiting: false }
                          : msg,
                      ),
                    )
                  } else {
                    setChatMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === _id
                          ? { ...msg, content: parsedContent.content, reason: parsedContent.reason }
                          : msg,
                      ),
                    )
                  }
                }
              } catch (_) {
                // Ignore parsing errors
              }
            }
          }
        }
      }

      const finalContent = content.trim()
      setMessages((prev) => [...prev, { role: "assistant", content: finalContent }])
    } catch (error) {
      if ((error as any).name !== "AbortError") {
        console.error("生成消息失敗:", error)
        setChatMessages((prev) => prev.filter((msg) => msg.id !== _id))
      }
    } finally {
      setIsGenerating(false)
    }
  }

  // 發送用戶消息
  const sendMessage = async () => {
    if (!userInput.trim() || isGenerating) return

    const inputContent = userInput.trim()

    const userMessage: ChatMessage = {
      id: uuidv4(),
      content: inputContent, // Use stored content instead of userInput
      reason: "",
      timestamp: new Date(),
      isUser: true,
    }

    // Add user message to chat immediately
    setChatMessages((prev) => [...prev, userMessage])

    // Create new messages array for API call
    const newMessages: Message[] = [...messages, { role: "user", content: inputContent }]

    setUserInput("")
    setMessages(newMessages)

    // Generate AI response
    await generateResponse(newMessages)
  }

  useEffect(() => {
    const chatContainer = chatContainerRef.current
    const messagesEnd = messagesEndRef.current

    if (!chatContainer || !messagesEnd) return

    let observer: IntersectionObserver

    const checkScrollPosition = (isEndVisible?: boolean) => {
      const scrollHeight = chatContainer.scrollHeight
      const scrollTop = chatContainer.scrollTop
      const clientHeight = chatContainer.clientHeight
      const distanceToBottom = scrollHeight - scrollTop - clientHeight
      const isAtBottom = Math.abs(distanceToBottom) < 1

      const containerRect = chatContainer.getBoundingClientRect()
      const endRect = messagesEnd.getBoundingClientRect()
      const computedIsEndVisible =
        typeof isEndVisible !== "undefined"
          ? isEndVisible
          : endRect.top >= containerRect.top && endRect.bottom <= containerRect.bottom

      if (computedIsEndVisible) {
        setShowScrollToBottom(false)
      } else {
        setShowScrollToBottom(!isAtBottom)
      }
    }

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          checkScrollPosition(entry.isIntersecting)
        })
      },
      {
        root: chatContainer,
        threshold: 0.1,
      },
    )

    observer.observe(messagesEnd)

    const handleScroll = () => {
      checkScrollPosition()
    }

    chatContainer.addEventListener("scroll", handleScroll)

    const resizeObserver = new ResizeObserver(() => {
      checkScrollPosition()
    })

    resizeObserver.observe(chatContainer)
    checkScrollPosition()

    return () => {
      chatContainer.removeEventListener("scroll", handleScroll)
      resizeObserver.disconnect()
      observer.disconnect()
    }
  }, [chatMessages])

  useEffect(() => {
    if (!isAutoScrolling) return

    const chatContainer = chatContainerRef.current
    if (!chatContainer) return

    let animationFrameId: number

    const scrollSmoothly = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      animationFrameId = requestAnimationFrame(scrollSmoothly)
    }

    const handleWheel = (event: WheelEvent) => {
      if (chatContainer.contains(event.target as Node)) {
        setIsAutoScrolling(false)
      }
    }

    scrollSmoothly()
    window.addEventListener("wheel", handleWheel, { passive: true })

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener("wheel", handleWheel)
    }
  }, [isAutoScrolling])

  return (
    <div className="h-[88vh] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b shadow-sm">
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold">Simple AI Chat</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadConversation} disabled={chatMessages.length === 0}>
              <Download className="w-4 h-4 mr-1" />
              下載對話
            </Button>
            <Button variant="outline" onClick={() => setShowSystemPromptDialog(true)}>
              <Settings className="w-4 h-4 mr-1" />
              編輯 Prompt
            </Button>
            <Button variant="outline" onClick={onRestart}>
              重新開始
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        {chatMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-zinc-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">開始對話</p>
              <p className="text-sm">輸入訊息開始與 AI 聊天</p>
            </div>
          </div>
        ) : (
          <div ref={chatContainerRef} className="h-full p-4 overflow-y-auto">
            <div className="space-y-4 max-w-4xl mx-auto">
              {chatMessages.map((message, index) => {
                const isLastMessage = index === chatMessages.length - 1
                return (
                  <div key={message.id} className={cn("flex gap-3", message.isUser ? "flex-row-reverse" : "")}>
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        {message.isUser ? (
                          <User className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
                        ) : (
                          <MessageCircle className="w-6 h-6 text-blue-600" />
                        )}
                      </div>
                    </div>

                    <div className={cn("flex flex-col", message.isUser ? "items-end" : "items-start")}>
                      {/* Message Bubble */}
                      <div
                        className={cn(
                          "max-w-md px-4 py-2 rounded-2xl shadow-sm relative group",
                          message.isUser
                            ? "bg-blue-600 text-white rounded-br-md"
                            : "bg-white dark:bg-zinc-800 border rounded-tl-md",
                        )}
                      >
                        {message.isWaiting ? (
                          <div className="flex items-center gap-1">
                            <span className="text-sm">正在思考</span>
                            <div className="flex gap-1">
                              <div
                                className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce"
                                style={{ animationDelay: "0ms" }}
                              ></div>
                              <div
                                className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce"
                                style={{ animationDelay: "150ms" }}
                              ></div>
                              <div
                                className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce"
                                style={{ animationDelay: "300ms" }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <ReasoningBlock reason={message.reason} />
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>

                            <div className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              {/* Edit button for all messages */}
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-6 w-6 p-0 rounded-full"
                                onClick={() => {
                                  setEditingMessageId(message.id)
                                  setEditingMessageContent(message.content)
                                  setShowEditMessageDialog(true)
                                }}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>

                              {/* Delete button for last message */}
                              {isLastMessage && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-6 w-6 p-0 rounded-full"
                                  onClick={handleDeleteLastMessage}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}

                              {/* Refresh button for last assistant message */}
                              {isLastMessage && !message.isUser && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-6 w-6 p-0 rounded-full"
                                  onClick={handleRegenerateLastMessage}
                                  disabled={isGenerating}
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div
                        className={cn("text-xs text-zinc-400 mt-1 px-1", message.isUser ? "text-right" : "text-left")}
                      >
                        {message.timestamp.toLocaleTimeString("zh-TW", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Scroll to bottom button */}
            {showScrollToBottom && chatMessages.length > 0 && !isAutoScrolling && (
              <button
                onClick={() => setIsAutoScrolling(true)}
                className="sticky left-1/2 transform -translate-x-1/2 bg-black dark:bg-white opacity-40 hover:opacity-60 text-white dark:text-black p-3 rounded-full shadow-lg z-50"
                style={{ bottom: "2%" }}
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <UserInput
        isWaitingForUser={!isGenerating}
        userInput={userInput}
        setUserInput={setUserInput}
        handleUserSubmit={sendMessage}
      />

      <EditSystemPromptDialog
        open={showSystemPromptDialog}
        onOpenChange={setShowSystemPromptDialog}
        currentPrompt={systemPrompt}
        onSave={handleSystemPromptUpdate}
      />

      <EditMessageDialog
        open={showEditMessageDialog}
        onOpenChange={setShowEditMessageDialog}
        currentContent={editingMessageContent}
        onSave={(newContent) => {
          if (editingMessageId) {
            handleEditMessage(editingMessageId, newContent)
          }
        }}
      />
    </div>
  )
}
