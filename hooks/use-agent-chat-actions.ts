"use client"

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react"
import { toast } from "sonner"
import type { AgentSelectedModel, UIMessage } from "@/components/chat/types"
import type { AgentMessage } from "@/lib/agent/types"

type AgentTextPart = import("@/lib/agent/types").AgentTextPart

export function useAgentChatActions({
  agentSessionId,
  agentFetch,
  agentStoreDispatch,
  agentStoreMessages,
  agentStorePartsFor,
  agentName,
  agentSelectedModel,
  isGenerating,
  loadAgentMessages,
  setSubAgentSessionId,
  setSelectedToolFlowMessageId,
  setAgentPaused,
  agentManualStopRef,
  setIsGenerating,
  setAgentLocalBusy,
  setStatusText,
  setMessages,
}: {
  agentSessionId?: string
  agentFetch: (url: string, init?: RequestInit) => Promise<Response>
  agentStoreDispatch: (action: any) => void
  agentStoreMessages: AgentMessage[]
  agentStorePartsFor: (messageId: string) => import("@/lib/agent/types").AgentPart[]
  agentName: string
  agentSelectedModel: AgentSelectedModel | null
  isGenerating: boolean
  loadAgentMessages: (targetSessionId?: string) => Promise<boolean>
  setSubAgentSessionId: Dispatch<SetStateAction<string | null>>
  setSelectedToolFlowMessageId: Dispatch<SetStateAction<string | null>>
  setAgentPaused: Dispatch<SetStateAction<boolean>>
  agentManualStopRef: MutableRefObject<boolean>
  setIsGenerating: Dispatch<SetStateAction<boolean>>
  setAgentLocalBusy: Dispatch<SetStateAction<boolean>>
  setStatusText: Dispatch<SetStateAction<string>>
  setMessages: Dispatch<SetStateAction<UIMessage[]>>
}) {
  const handleAgentStopGeneration = useCallback(async () => {
    const sid = agentSessionId
    setSubAgentSessionId(null)
    setAgentPaused(true)
    agentManualStopRef.current = true
    setIsGenerating(false)
    setAgentLocalBusy(false)
    setStatusText("")
    if (!sid) return

    agentStoreDispatch({
      type: "SSE_BATCH",
      events: [{ type: "session.status", properties: { sessionID: sid, status: "idle" } }],
    })

    try {
      const res = await agentFetch(`/api/agent/session/${sid}/abort`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || "停止 Agent 生成失敗")
      }
      await loadAgentMessages(sid)
      toast.success("已暫停 Agent 生成")
    } catch (error: any) {
      toast.error(error?.message || "停止 Agent 生成失敗")
    }
  }, [
    agentFetch,
    agentManualStopRef,
    agentSessionId,
    agentStoreDispatch,
    loadAgentMessages,
    setAgentLocalBusy,
    setAgentPaused,
    setIsGenerating,
    setStatusText,
    setSubAgentSessionId,
  ])

  const handleAgentRegenerate = useCallback(async (msgId: string) => {
    const sid = agentSessionId
    if (!sid) {
      toast.error("目前沒有可重新生成的 Agent 會話")
      return
    }
    if (isGenerating) return

    const idx = agentStoreMessages.findIndex((message) => message.id === msgId)
    if (idx < 0) {
      toast.error("找不到可重新生成的 Agent 訊息")
      return
    }

    const assistantMsg = agentStoreMessages[idx]
    if (assistantMsg.role !== "assistant") return

    let userMsg = null as AgentMessage | null
    for (let i = idx - 1; i >= 0; i -= 1) {
      if (agentStoreMessages[i].role === "user") {
        userMsg = agentStoreMessages[i]
        break
      }
    }
    if (!userMsg) {
      toast.error("找不到可重新生成的使用者訊息")
      return
    }

    const userText = agentStorePartsFor(userMsg.id)
      .filter((part): part is AgentTextPart => part.type === "text")
      .map((part) => part.text)
      .join("\n\n")
      .trim()

    if (!userText) {
      toast.error("找不到可重新生成的使用者訊息內容")
      return
    }

    const waitingId = `agent-regen-wait-${Date.now()}`
    setMessages((prev) => {
      const next = prev.filter((message) => message.id !== waitingId)
      next.push({
        id: waitingId,
        role: "assistant",
        content: "",
        isStreaming: true,
      })
      return next
    })

    setSubAgentSessionId(null)
    setSelectedToolFlowMessageId((current) => (current === assistantMsg.id ? null : current))
    setAgentPaused(false)
    agentManualStopRef.current = false
    setIsGenerating(true)
    setAgentLocalBusy(true)
    setStatusText("Agent 重新生成中...")

    let failed = false
    try {
      const revertRes = await agentFetch(`/api/agent/session/${sid}/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageID: assistantMsg.id }),
      })
      const revertPayload = await revertRes.json()
      if (!revertRes.ok) {
        throw new Error(revertPayload?.error || "Agent 回退失敗")
      }

      const promptRes = await agentFetch(`/api/agent/session/${sid}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          agent: agentName || undefined,
          model: agentSelectedModel || undefined,
        }),
      })
      const promptPayload = await promptRes.json()
      if (!promptRes.ok) {
        throw new Error(promptPayload?.error || "Agent 重新生成失敗")
      }

      await loadAgentMessages(sid)
      setMessages((prev) => prev.filter((message) => message.id !== waitingId))
    } catch (error: any) {
      failed = true
      setMessages((prev) =>
        prev.map((message) =>
          message.id === waitingId
            ? { ...message, isStreaming: false, content: error?.message || "Agent 重新生成失敗" }
            : message
        )
      )
      toast.error(error?.message || "Agent 重新生成失敗")
    } finally {
      if (failed) {
        setIsGenerating(false)
        setAgentLocalBusy(false)
        setStatusText("")
      }
    }
  }, [
    agentFetch,
    agentManualStopRef,
    agentName,
    agentSelectedModel,
    agentSessionId,
    agentStoreMessages,
    agentStorePartsFor,
    isGenerating,
    loadAgentMessages,
    setAgentLocalBusy,
    setAgentPaused,
    setIsGenerating,
    setMessages,
    setSelectedToolFlowMessageId,
    setStatusText,
    setSubAgentSessionId,
  ])

  return {
    handleAgentStopGeneration,
    handleAgentRegenerate,
  }
}
