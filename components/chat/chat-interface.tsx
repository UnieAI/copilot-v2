"use client"

import { useState, useRef, useEffect } from "react"
import { useSearchParams } from "next/navigation"

type Message = {
    id: string
    role: "user" | "assistant" | "system"
    content: string
}

export function ChatInterface({ sessionId, availableModels }: { sessionId?: string, availableModels: string[] }) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [selectedModel, setSelectedModel] = useState(availableModels[0] || "")
    const [isGenerating, setIsGenerating] = useState(false)
    const [statusText, setStatusText] = useState("")

    useEffect(() => {
        if (availableModels.length > 0 && !selectedModel) {
            setSelectedModel(availableModels[0])
        }
    }, [availableModels])

    // Fetch messages logic (stub for now, will connect to server actions later)
    useEffect(() => {
        if (sessionId) {
            // Mock load history
            setMessages([{ id: "1", role: "assistant", content: "Loaded chat history for " + sessionId }])
        } else {
            setMessages([{ id: "0", role: "assistant", content: "Hello! How can I help you today?" }])
        }
    }, [sessionId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isGenerating) return

        const userMsg: Message = { id: Date.now().toString(), role: "user", content: input }
        const newMessages = [...messages, userMsg]
        setMessages(newMessages)
        setInput("")
        setIsGenerating(true)
        setStatusText("正在準備連線...")

        const aiMsgId = (Date.now() + 1).toString()
        setMessages(prev => [...prev, { id: aiMsgId, role: "assistant", content: "" }])

        try {
            const res = await fetch("/api/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: newMessages.map(m => ({ role: m.role, content: m.content })),
                    sessionId: sessionId,
                    selectedModel: selectedModel,
                    attachments: [] // Todo implementation
                })
            })

            if (!res.ok || !res.body) {
                setStatusText("Error: " + res.statusText)
                setIsGenerating(false)
                return
            }

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let done = false

            while (!done) {
                const { value, done: doneReading } = await reader.read()
                done = doneReading
                if (value) {
                    const chunk = decoder.decode(value, { stream: true })
                    const lines = chunk.split('\n')

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.replace('data: ', '').trim()
                            if (!dataStr || dataStr === '[DONE]') continue

                            try {
                                const data = JSON.parse(dataStr)

                                if (data.type === 'status') {
                                    setStatusText(data.data)
                                } else if (data.type === 'session_id' && !sessionId) {
                                    window.history.pushState({}, '', `/?id=${data.data}`)
                                } else if (data.type === 'chunk') {
                                    setMessages(prev => prev.map(m =>
                                        m.id === aiMsgId ? { ...m, content: m.content + data.data } : m
                                    ))
                                } else if (data.type === 'error') {
                                    setStatusText("連線錯誤: " + data.data)
                                }
                            } catch (e) {
                                console.error("Error parsing SSE JSON", dataStr)
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Stream failed", e)
            setStatusText("Request Failed")
        } finally {
            setIsGenerating(false)
            setStatusText("")
        }
    }

    return (
        <div className="flex flex-col h-full relative">
            {/* Header config */}
            <div className="p-4 border-b flex items-center justify-between">
                <div>
                    <select
                        className="border rounded p-1 text-sm bg-background"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                    >
                        {availableModels.length === 0 && <option>No models available</option>}
                        {availableModels.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map(m => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-lg ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            {m.content}
                        </div>
                    </div>
                ))}
            </div>

            {/* Status Indicator */}
            {isGenerating && statusText && (
                <div className="text-center text-sm text-muted-foreground py-2">
                    {statusText}
                </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t bg-background">
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="file"
                        multiple
                        className="hidden"
                        id="file-upload"
                        accept=".pdf,.doc,.docx,.txt,.csv,.json,.png,.jpg,.jpeg"
                    />
                    <label htmlFor="file-upload" className="p-2 border rounded cursor-pointer hover:bg-muted content-center">
                        📎
                    </label>
                    <input
                        className="flex-1 border rounded p-2 bg-background focus:outline-none focus:ring-1"
                        placeholder="Type a message..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        disabled={isGenerating}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isGenerating}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium disabled:opacity-50"
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    )
}
