"use client"

import { useCallback, type Dispatch, type FormEvent, type MutableRefObject, type SetStateAction } from "react"
import { toast } from "sonner"
import { streamStore } from "@/lib/stream-store"
import type { Attachment, AvailableModel, UIMessage } from "@/components/chat/types"

type ChatMode = "normal" | "agent"

type RouterLike = {
  replace: (href: string) => void
  refresh: () => void
}

type SendAgentMessage = (
  content: string,
  atts: Attachment[],
  msgEditId?: string,
  keptAtts?: Attachment[]
) => Promise<void>

type UseChatSendParams = {
  chatMode: ChatMode
  isGenerating: boolean
  isSetupBlocked: boolean
  input: string
  attachments: Attachment[]
  messages: UIMessage[]
  setMessages: Dispatch<SetStateAction<UIMessage[]>>
  setIsGenerating: Dispatch<SetStateAction<boolean>>
  setStatusText: Dispatch<SetStateAction<string>>
  setInput: Dispatch<SetStateAction<string>>
  setAttachments: Dispatch<SetStateAction<Attachment[]>>
  selectedModel: string
  availableModels: AvailableModel[]
  systemPrompt: string
  sessionId?: string
  setSessionId: Dispatch<SetStateAction<string | undefined>>
  projectId?: string
  localePrefix: string
  router: RouterLike
  onSessionCreated?: (id: string, title: string) => void
  storeKeyRef: MutableRefObject<string | null>
  abortControllerRef: MutableRefObject<AbortController | null>
  sendAgentMessage: SendAgentMessage
  onStopAgentGeneration: () => Promise<void>
  onRegenerateAgentMessage: (messageId: string) => Promise<void>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function useChatSend({
  chatMode,
  isGenerating,
  isSetupBlocked,
  input,
  attachments,
  messages,
  setMessages,
  setIsGenerating,
  setStatusText,
  setInput,
  setAttachments,
  selectedModel,
  availableModels,
  systemPrompt,
  sessionId,
  setSessionId,
  projectId,
  localePrefix,
  router,
  onSessionCreated,
  storeKeyRef,
  abortControllerRef,
  sendAgentMessage,
  onStopAgentGeneration,
  onRegenerateAgentMessage,
}: UseChatSendParams) {
  const isValidUuid = useCallback((value?: string) => Boolean(value && UUID_RE.test(value)), [])

  const sendNormalMessage = useCallback(async (
    content: string,
    atts: Attachment[],
    msgEditId?: string,
    keptAtts: Attachment[] = []
  ) => {
    const allAtts = [...keptAtts, ...atts]
    if (!content.trim() && allAtts.length === 0) return
    if (isGenerating) return
    if (!selectedModel) {
      toast.error("請先在設定頁面配置並選擇一個模型。")
      return
    }

    setIsGenerating(true)
    setStatusText("正在連線...")

    const selModelObj = availableModels.find((m) => m.value === selectedModel)
    if (selModelObj) {
      fetch("/api/user/preference", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedModel: selModelObj.label,
          selectedProviderPrefix: selModelObj.providerPrefix,
        }),
      }).catch(() => {})
    }

    const userMsg: UIMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      attachments: allAtts.map((a) => ({ name: a.name, mimeType: a.mimeType, base64: a.base64 })),
    }

    const safeEditId = isValidUuid(msgEditId) ? msgEditId : undefined
    const historyMessages = safeEditId
      ? (() => {
          const cutIdx = messages.findIndex((m) => m.dbId === safeEditId)
          return cutIdx >= 0 ? messages.slice(0, cutIdx) : messages
        })()
      : messages

    const aiMsgId = `ai-${Date.now()}`
    setMessages([...historyMessages, userMsg, { id: aiMsgId, role: "assistant", content: "", isStreaming: true }])
    setInput("")
    setAttachments([])

    const conversationHistory = historyMessages.map((m) => ({ id: m.dbId, role: m.role, content: m.content }))
    conversationHistory.push({ id: undefined, role: "user" as const, content })

    const failActiveStream = (errorText?: string) => {
      const fallback = errorText || "產生回應失敗，請稍後再試。"
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, isStreaming: false, content: m.content || fallback } : m))
      )
      const activeKey = storeKeyRef.current
      if (activeKey) {
        streamStore.update(activeKey, (entry) => {
          entry.isGenerating = false
          entry.statusText = ""
          entry.messages = entry.messages.map((m) =>
            m.id === aiMsgId ? { ...m, isStreaming: false, content: m.content || fallback } : m
          )
        })
        streamStore.finish(activeKey)
        window.dispatchEvent(new CustomEvent("chat:active", { detail: null }))
        storeKeyRef.current = null
      }
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
      setIsGenerating(false)
      setStatusText("")
    }

    try {
      const ac = new AbortController()
      abortControllerRef.current = ac

      const tempKey = sessionId || `pending-${Date.now()}`
      const initialStoreMessages: UIMessage[] = [
        ...historyMessages,
        userMsg,
        { id: aiMsgId, role: "assistant", content: "", isStreaming: true },
      ]
      streamStore.register(tempKey, initialStoreMessages as any, ac)
      storeKeyRef.current = tempKey
      window.dispatchEvent(new CustomEvent("chat:active", { detail: tempKey }))

      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          messages: conversationHistory,
          sessionId: sessionId || null,
          selectedModel,
          systemPrompt: systemPrompt || null,
          attachments: allAtts,
          editMessageId: safeEditId || null,
          projectId: projectId || null,
        }),
      })

      if (!res.ok || !res.body) {
        const errMsg = `請求失敗: ${res.statusText}`
        toast.error(errMsg)
        failActiveStream(errMsg)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const tempUserMsgId = userMsg.id
      let buffer = ""
      let streamErrored = false

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const dataStr = line.slice(6).trim()
          if (!dataStr) continue
          try {
            const ev = JSON.parse(dataStr)
            if (ev.type === "session_id") {
              const realId = ev.data as string
              if (storeKeyRef.current && storeKeyRef.current !== realId) {
                streamStore.rekey(storeKeyRef.current, realId)
                storeKeyRef.current = realId
                window.dispatchEvent(new CustomEvent("chat:active", { detail: realId }))
              }
              setSessionId(realId)
              const targetPath = projectId ? `${localePrefix}/p/${projectId}/c/${realId}` : `${localePrefix}/c/${realId}`
              router.replace(targetPath)
              onSessionCreated?.(realId, "")
            } else if (ev.type === "status") {
              setStatusText(ev.data)
              if (storeKeyRef.current) {
                streamStore.update(storeKeyRef.current, (entry) => {
                  entry.statusText = ev.data
                })
              }
            } else if (ev.type === "chunk") {
              setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, content: m.content + ev.data } : m)))
              if (storeKeyRef.current) {
                streamStore.update(storeKeyRef.current, (entry) => {
                  const msg = entry.messages.find((m) => m.id === aiMsgId)
                  if (msg) msg.content += ev.data
                })
              }
            } else if (ev.type === "error") {
              toast.error(ev.data)
              failActiveStream(ev.data)
              streamErrored = true
              break
            } else if (ev.type === "title_updated") {
              window.dispatchEvent(new CustomEvent("sidebar:refresh"))
              if (ev.data?.sessionId && ev.data?.title) {
                onSessionCreated?.(ev.data.sessionId, ev.data.title)
              }
            } else if (ev.type === "done") {
              const aiMsgDbId: string | undefined = ev.data?.messageId
              const userMsgDbId: string | undefined = ev.data?.userMessageId
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id === aiMsgId) return { ...m, isStreaming: false, dbId: aiMsgDbId }
                  if (m.id === tempUserMsgId) return { ...m, dbId: userMsgDbId }
                  return m
                })
              )
              if (storeKeyRef.current) {
                streamStore.update(storeKeyRef.current, (entry) => {
                  const aiMsg = entry.messages.find((m) => m.id === aiMsgId)
                  if (aiMsg) {
                    aiMsg.isStreaming = false
                    aiMsg.dbId = aiMsgDbId
                  }
                  const userMsgInStore = entry.messages.find((m) => m.id === tempUserMsgId)
                  if (userMsgInStore) userMsgInStore.dbId = userMsgDbId
                  entry.isGenerating = false
                  entry.statusText = ""
                })
              }
              setIsGenerating(false)
              setStatusText("")
            }
          } catch {}
        }
        if (streamErrored) break
      }

      if (streamErrored) return

      const finishedKey = storeKeyRef.current
      if (finishedKey) {
        streamStore.finish(finishedKey)
        window.dispatchEvent(new CustomEvent("chat:active", { detail: null }))
        storeKeyRef.current = null
        abortControllerRef.current = null
        if (!finishedKey.startsWith("pending-")) {
          router.refresh()
        }
      }
    } catch (error: any) {
      if (error?.name === "AbortError") {
        setIsGenerating(false)
        setStatusText("")
        abortControllerRef.current = null
        if (storeKeyRef.current) {
          streamStore.abort(storeKeyRef.current)
          window.dispatchEvent(new CustomEvent("chat:active", { detail: null }))
          storeKeyRef.current = null
        }
        return
      }
      toast.error(`串流連線失敗: ${error?.message || ""}`)
      failActiveStream()
    } finally {
      setIsGenerating(false)
      setStatusText("")
    }
  }, [
    abortControllerRef,
    availableModels,
    isGenerating,
    isValidUuid,
    localePrefix,
    messages,
    onSessionCreated,
    projectId,
    router,
    selectedModel,
    sessionId,
    setAttachments,
    setIsGenerating,
    setInput,
    setMessages,
    setSessionId,
    setStatusText,
    storeKeyRef,
    systemPrompt,
  ])

  const sendMessage = useCallback(async (
    content: string,
    atts: Attachment[],
    msgEditId?: string,
    keptAtts: Attachment[] = []
  ) => {
    if (chatMode === "agent") {
      return sendAgentMessage(content, atts, msgEditId, keptAtts)
    }
    return sendNormalMessage(content, atts, msgEditId, keptAtts)
  }, [chatMode, sendAgentMessage, sendNormalMessage])

  const handleSubmit = useCallback((e?: FormEvent) => {
    e?.preventDefault()
    if (isSetupBlocked || isGenerating) return
    void sendMessage(input, attachments)
  }, [attachments, input, isGenerating, isSetupBlocked, sendMessage])

  const handleStopGeneration = useCallback(async () => {
    if (!isGenerating) return

    setMessages((prev) => prev.map((message) => (message.isStreaming ? { ...message, isStreaming: false } : message)))

    if (chatMode === "agent") {
      await onStopAgentGeneration()
      return
    }

    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    if (storeKeyRef.current) {
      streamStore.abort(storeKeyRef.current)
      window.dispatchEvent(new CustomEvent("chat:active", { detail: null }))
      storeKeyRef.current = null
    }
    setIsGenerating(false)
    setStatusText("")
  }, [abortControllerRef, chatMode, isGenerating, onStopAgentGeneration, setIsGenerating, setMessages, setStatusText, storeKeyRef])

  const handleRegenerate = useCallback(async (msgId: string) => {
    if (chatMode === "agent") {
      await onRegenerateAgentMessage(msgId)
      return
    }

    const idx = messages.findIndex((m) => m.id === msgId || m.dbId === msgId)
    if (idx <= 0) return
    const userMsg = messages[idx - 1]
    if (userMsg.role !== "user") return

    const regenEditId = isValidUuid(userMsg.dbId) ? userMsg.dbId : undefined
    const prevMessages = messages.slice(0, idx - 1)
    const aiMsgId = `ai-regen-${Date.now()}`

    setMessages([...prevMessages, userMsg, { id: aiMsgId, role: "assistant", content: "", isStreaming: true }])
    setIsGenerating(true)
    setStatusText("正在重新生成...")

    const markRegenFailed = (errorText?: string) => {
      const fallback = errorText || "重新生成失敗，請稍後再試。"
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, isStreaming: false, content: m.content || fallback } : m))
      )
    }

    const history = [...prevMessages.map((m) => ({ id: m.dbId, role: m.role, content: m.content })), { role: "user", content: userMsg.content }]
    const userAtts = (userMsg.attachments || []).map((a) => ({
      name: a.name,
      mimeType: a.mimeType,
      base64: a.base64 || "",
    }))

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          sessionId,
          selectedModel,
          systemPrompt: systemPrompt || null,
          attachments: userAtts,
          editMessageId: regenEditId || null,
        }),
      })

      if (!res.ok || !res.body) {
        const errMsg = `重新生成失敗: ${res.statusText}`
        toast.error(errMsg)
        markRegenFailed(errMsg)
        setIsGenerating(false)
        setStatusText("")
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const existingUserMsgId = userMsg.id
      let buffer = ""
      let streamErrored = false

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const ev = JSON.parse(line.slice(6).trim())
            if (ev.type === "status") {
              setStatusText(ev.data)
            } else if (ev.type === "chunk") {
              setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, content: m.content + ev.data } : m)))
            } else if (ev.type === "title_updated") {
              window.dispatchEvent(new CustomEvent("sidebar:refresh"))
            } else if (ev.type === "error") {
              toast.error(ev.data)
              markRegenFailed(ev.data)
              streamErrored = true
              break
            } else if (ev.type === "done") {
              const aiMsgDbId: string | undefined = ev.data?.messageId
              const newUserMsgDbId: string | undefined = ev.data?.userMessageId
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id === aiMsgId) return { ...m, isStreaming: false, dbId: aiMsgDbId }
                  if (m.id === existingUserMsgId) return { ...m, dbId: newUserMsgDbId }
                  return m
                })
              )
              setIsGenerating(false)
              setStatusText("")
            }
          } catch {}
        }
        if (streamErrored) break
      }

      if (streamErrored) return
      if (sessionId) router.refresh()
    } catch (error: any) {
      toast.error(`重新生成失敗: ${error?.message || ""}`)
      markRegenFailed()
    } finally {
      setIsGenerating(false)
      setStatusText("")
    }
  }, [chatMode, isValidUuid, messages, onRegenerateAgentMessage, router, selectedModel, sessionId, setIsGenerating, setMessages, setStatusText, systemPrompt])

  return {
    isValidUuid,
    sendMessage,
    handleSubmit,
    handleStopGeneration,
    handleRegenerate,
  }
}
