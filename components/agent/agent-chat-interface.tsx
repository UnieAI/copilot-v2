"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  ArrowUpRight,
  Bot,
  Check,
  ChevronLeft,
  Loader2,
  MessageCircleQuestion,
  Send,
  ShieldAlert,
  User,
  Wrench,
  X,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { MessageContent } from "@/components/chat/markdown-components"
import { useInstanceStore } from "@/hooks/use-instance-store"
import { appendInstanceParams } from "@/lib/opencode/client-utils"
import { InstanceSelector } from "@/components/agent/instance-selector"

type SelectedModel = {
  providerID: string
  modelID: string
}

type TextPart = {
  type: "text"
  text: string
}

type ToolPart = {
  type: "tool"
  callID?: string
  tool?: string
  metadata?: Record<string, unknown>
  state?: {
    status?: string
    input?: Record<string, unknown>
    title?: string
    metadata?: Record<string, unknown>
    output?: string
    error?: string
    raw?: string
  }
}

type MessagePart = TextPart | ToolPart | Record<string, unknown>

type MessageInfo = {
  id: string
  role: string
  time?: { created?: number }
  agent?: string
  model?: SelectedModel
}

type MessageWithParts = {
  info: MessageInfo
  parts: MessagePart[]
  isQueued?: boolean
}

type QueuedMessage = {
  id: string
  text: string
}

type AgentOption = {
  name: string
  description?: string
}

type ModelOption = {
  key: string
  providerID: string
  providerName: string
  modelID: string
  modelName: string
}

type SessionOption = {
  id: string
  title?: string
  parentID?: string
}

type PermissionRequest = {
  id: string
  sessionID: string
  permission: string
  patterns: string[]
  metadata?: Record<string, unknown>
}

type QuestionOption = {
  label: string
  description?: string
}

type QuestionInfo = {
  question: string
  header?: string
  options: QuestionOption[]
  multiple?: boolean
  custom?: boolean
}

type QuestionRequest = {
  id: string
  sessionID: string
  questions: QuestionInfo[]
}

type QuestionDraft = {
  answers: Record<number, string[]>
  customEnabled: Record<number, boolean>
  customText: Record<number, string>
}

const AGENT_STORAGE_KEY = "opencode-selected-agents"
const MODEL_STORAGE_KEY = "opencode-selected-model"

function getTextContent(parts: MessagePart[]) {
  return parts
    .filter((part): part is TextPart => part?.type === "text" && typeof (part as TextPart).text === "string")
    .map((part) => part.text)
    .join("\n\n")
}

function shouldAnimateGeneratedText(text: string): boolean {
  if (!text.trim()) return false
  return !/```|`|\[[^\]]+\]\([^)]+\)|(^|\n)\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)|\|.*\|/m.test(text)
}

function isToolPart(part: MessagePart): part is ToolPart {
  return part?.type === "tool"
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function truncate(value: string, max = 180) {
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

function stringifyValue(value: unknown) {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value === null) return "null"
  if (typeof value === "undefined") return "undefined"
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

type ToolStatus = "pending" | "running" | "completed" | "error" | "unknown"

function getToolStatus(part: ToolPart): ToolStatus {
  const status = String(part.state?.status || "").toLowerCase()
  if (status === "pending" || status === "running" || status === "completed" || status === "error") {
    return status
  }
  return "unknown"
}

function getToolInput(part: ToolPart) {
  return toRecord(part.state?.input) || {}
}

function getToolMetadata(part: ToolPart) {
  return {
    part: toRecord(part.metadata) || {},
    state: toRecord(part.state?.metadata) || {},
  }
}

function getToolOutput(part: ToolPart) {
  const stateOutput = part.state?.output
  if (typeof stateOutput === "string" && stateOutput.trim()) return stateOutput

  const rawOutput = part.state?.raw
  if (typeof rawOutput === "string" && rawOutput.trim()) return rawOutput

  const { part: partMeta, state: stateMeta } = getToolMetadata(part)
  const metaOutput = stateMeta.output ?? partMeta.output
  if (typeof metaOutput === "string" && metaOutput.trim()) return metaOutput

  return ""
}

function getToolError(part: ToolPart) {
  const stateError = part.state?.error
  if (typeof stateError === "string" && stateError.trim()) return stateError
  return ""
}

function getTaskChildSessionId(part: ToolPart) {
  const { part: partMeta, state: stateMeta } = getToolMetadata(part)
  const keys = [
    "sessionId",
    "sessionID",
    "session_id",
    "childSessionId",
    "child_session_id",
    "taskId",
    "taskID",
    "task_id",
  ] as const
  for (const key of keys) {
    const value = stateMeta[key] ?? partMeta[key]
    if (typeof value === "string" && value.trim()) return value
  }
  return ""
}

function getToolTitle(part: ToolPart) {
  const name = String(part.tool || "tool").toLowerCase()
  const input = getToolInput(part)

  if (name === "task") {
    const subagent = input.subagent_type
    if (typeof subagent === "string" && subagent.trim()) {
      return `agent · ${subagent}`
    }
    return "agent"
  }

  const titleMap: Record<string, string> = {
    read: "read",
    list: "list",
    glob: "glob",
    grep: "grep",
    webfetch: "web",
    bash: "shell",
    edit: "edit",
    write: "write",
    apply_patch: "patch",
  }

  return titleMap[name] || name
}

function getToolSubtitle(part: ToolPart) {
  const input = getToolInput(part)
  const stateTitle = part.state?.title
  if (typeof stateTitle === "string" && stateTitle.trim()) return stateTitle

  if (typeof input.description === "string" && input.description.trim()) return input.description
  if (typeof input.filePath === "string" && input.filePath.trim()) return input.filePath
  if (typeof input.path === "string" && input.path.trim()) return input.path
  if (typeof input.url === "string" && input.url.trim()) return input.url
  if (typeof input.pattern === "string" && input.pattern.trim()) return `pattern=${input.pattern}`

  return ""
}

function getToolInputLines(part: ToolPart) {
  const input = getToolInput(part)
  const ignoreKeys = new Set(["description"])
  return Object.entries(input)
    .filter(([key]) => !ignoreKeys.has(key))
    .map(([key, value]) => `${key}: ${truncate(stringifyValue(value), 220)}`)
}

function normalizeMessages(payload: any): MessageWithParts[] {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.messages)
      ? payload.messages
      : Array.isArray(payload?.data)
        ? payload.data
        : []

  return list.map((item: any, idx: number) => {
    const info = item?.info || item || {}
    const id = String(info.id || item?.id || `msg-${idx}`)
    const role = String(info.role || item?.role || "assistant")
    const parts = Array.isArray(item?.parts)
      ? item.parts
      : typeof item?.content === "string"
        ? [{ type: "text", text: item.content }]
        : []

    return {
      info: {
        id,
        role,
        time: info.time,
        agent: info.agent,
        model: info.model,
      },
      parts,
      isQueued: false,
    }
  })
}

function normalizeAgents(payload: any): AgentOption[] {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.agents)
      ? payload.agents
      : Array.isArray(payload?.data)
        ? payload.data
        : []

  return list
    .map((item: any) => ({
      name: String(item?.name || ""),
      description: item?.description ? String(item.description) : undefined,
    }))
    .filter((item: AgentOption) => item.name)
}

function normalizeProviders(payload: any): { models: ModelOption[]; defaultModel: SelectedModel | null } {
  const root = payload?.providers
    ? payload
    : payload?.data?.providers
      ? payload.data
      : payload

  const providers = Array.isArray(root?.providers) ? root.providers : []
  const defaults = typeof root?.default === "object" && root?.default ? root.default : {}

  const models: ModelOption[] = []

  for (const provider of providers) {
    const providerID = String(provider?.id || provider?.providerID || "")
    if (!providerID) continue

    const providerName = String(provider?.name || providerID)
    const source = provider?.models

    const items = Array.isArray(source)
      ? source
      : source && typeof source === "object"
        ? Object.values(source)
        : []

    for (const model of items as any[]) {
      const modelID = String(model?.id || model?.modelID || "")
      if (!modelID) continue

      const modelName = String(model?.name || modelID)
      models.push({
        key: `${providerID}/${modelID}`,
        providerID,
        providerName,
        modelID,
        modelName,
      })
    }
  }

  let defaultModel: SelectedModel | null = null
  for (const [providerID, modelID] of Object.entries(defaults as Record<string, string>)) {
    if (modelID) {
      defaultModel = { providerID, modelID }
      break
    }
  }

  return { models, defaultModel }
}

function normalizeSession(payload: any): SessionOption | null {
  const data = payload?.data ?? payload
  if (!data || typeof data !== "object") return null

  const id = String((data as any).id || "")
  if (!id) return null

  return {
    id,
    title: typeof (data as any).title === "string" ? (data as any).title : undefined,
    parentID: typeof (data as any).parentID === "string" ? (data as any).parentID : undefined,
  }
}

function normalizeSessions(payload: any): SessionOption[] {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : []

  return list
    .map((item: any): SessionOption | null => normalizeSession(item))
    .filter((item: SessionOption | null): item is SessionOption => !!item)
}

function normalizePermissions(payload: any): PermissionRequest[] {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : []

  return list
    .map((item: any) => ({
      id: String(item?.id || ""),
      sessionID: String(item?.sessionID || ""),
      permission: String(item?.permission || "permission"),
      patterns: Array.isArray(item?.patterns)
        ? item.patterns.filter((p: unknown) => typeof p === "string")
        : [],
      metadata: toRecord(item?.metadata),
    }))
    .filter((item: PermissionRequest) => item.id && item.sessionID)
}

function normalizeQuestions(payload: any): QuestionRequest[] {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : []

  return list
    .map((item: any) => ({
      id: String(item?.id || ""),
      sessionID: String(item?.sessionID || ""),
      questions: Array.isArray(item?.questions)
        ? item.questions
          .map((question: any) => ({
            question: String(question?.question || ""),
            header: question?.header ? String(question.header) : undefined,
            options: Array.isArray(question?.options)
              ? question.options
                .map((option: any) => ({
                  label: String(option?.label || ""),
                  description: option?.description ? String(option.description) : undefined,
                }))
                .filter((option: QuestionOption) => option.label)
              : [],
            multiple: !!question?.multiple,
            custom: question?.custom !== false,
          }))
          .filter((question: QuestionInfo) => question.question)
        : [],
    }))
    .filter((item: QuestionRequest) => item.id && item.sessionID && item.questions.length > 0)
}

function readAgentStorage(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(AGENT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveAgentStorage(data: Record<string, string>) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(data))
}

function readModelStorage(): SelectedModel | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(MODEL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.providerID && parsed?.modelID) {
      return { providerID: String(parsed.providerID), modelID: String(parsed.modelID) }
    }
  } catch {
    return null
  }
  return null
}

function saveModelStorage(model: SelectedModel) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(model))
}

function getDefaultQuestionDraft(): QuestionDraft {
  return {
    answers: {},
    customEnabled: {},
    customText: {},
  }
}

type AgentChatInterfaceProps = {
  initialSessionId?: string
  onSwitchToNormal?: () => void
  buildSessionHref?: (sessionId: string) => string
  onSessionChange?: (sessionId: string) => void
}

export function AgentChatInterface({
  initialSessionId,
  onSwitchToNormal,
  buildSessionHref,
  onSessionChange,
}: AgentChatInterfaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { instance } = useInstanceStore()
  const segments = pathname?.split("/").filter(Boolean) || []
  const localePrefix = segments.length && segments[0].length <= 5 ? `/${segments[0]}` : ""
  const agentPath = `${localePrefix}/agent`
  const resolveSessionHref = useCallback(
    (nextSessionId: string) => {
      return buildSessionHref
        ? buildSessionHref(nextSessionId)
        : `${agentPath}?id=${encodeURIComponent(nextSessionId)}`
    },
    [agentPath, buildSessionHref]
  )

  const agentFetch = useCallback(
    (url: string, init?: RequestInit) => fetch(appendInstanceParams(url, instance), init),
    [instance]
  )

  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null)
  const [messages, setMessages] = useState<MessageWithParts[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [models, setModels] = useState<ModelOption[]>([])
  const [selectedAgent, setSelectedAgent] = useState("")
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(null)
  const [input, setInput] = useState("")
  const [loadingSession, setLoadingSession] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([])

  const [sessionInfo, setSessionInfo] = useState<SessionOption | null>(null)
  const [childSessions, setChildSessions] = useState<SessionOption[]>([])
  const [permissions, setPermissions] = useState<PermissionRequest[]>([])
  const [questions, setQuestions] = useState<QuestionRequest[]>([])
  const [respondingPermissionId, setRespondingPermissionId] = useState<string | null>(null)
  const [respondingQuestionId, setRespondingQuestionId] = useState<string | null>(null)
  const [questionDrafts, setQuestionDrafts] = useState<Record<string, QuestionDraft>>({})

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const isProcessingQueueRef = useRef(false)

  const selectedModelKey = selectedModel ? `${selectedModel.providerID}/${selectedModel.modelID}` : ""

  const activePermission = permissions[0] || null
  const activeQuestion = questions[0] || null
  const isBlockedByDock = !!activePermission || !!activeQuestion

  const goToSession = useCallback(
    (nextSessionId: string) => {
      if (!nextSessionId) return
      setSessionId(nextSessionId)
      setMessages([])
      setMessageQueue([])
      setError(null)
      onSessionChange?.(nextSessionId)
      router.push(resolveSessionHref(nextSessionId))
    },
    [onSessionChange, resolveSessionHref, router]
  )

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  const checkNearBottom = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return true
    const threshold = 120
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    isNearBottomRef.current = nearBottom
    return nearBottom
  }, [])

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    const onScroll = () => {
      checkNearBottom()
    }

    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [checkNearBottom])

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom("smooth")
    }
  }, [messages.length, scrollToBottom])

  useEffect(() => {
    if (!initialSessionId) return
    setSessionId((current) => (current === initialSessionId ? current : initialSessionId))
  }, [initialSessionId])

  const createSession = useCallback(async () => {
    setLoadingSession(true)
    setError(null)

    try {
      const res = await agentFetch("/api/agent/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const payload = await res.json()

      if (!res.ok) {
        throw new Error(payload?.error || "Failed to create agent session")
      }

      const id = String(payload?.id || payload?.info?.id || payload?.sessionID || "")
      if (!id) {
        throw new Error("OpenCode returned an invalid session id")
      }

      setSessionId(id)
      setMessages([])
      setPermissions([])
      setQuestions([])
      setSessionInfo(null)
      setChildSessions([])
      onSessionChange?.(id)
      router.replace(resolveSessionHref(id))
    } catch (e: any) {
      setError(e?.message || "Failed to create agent session")
    } finally {
      setLoadingSession(false)
    }
  }, [agentFetch, onSessionChange, resolveSessionHref, router])

  useEffect(() => {
    if (!sessionId && !loadingSession) {
      createSession()
    }
  }, [createSession, loadingSession, sessionId])

  const loadMessages = useCallback(
    async (showLoading = false) => {
      if (!sessionId) return

      if (showLoading) setLoadingMessages(true)

      try {
        const res = await agentFetch(`/api/agent/session/${sessionId}/messages`, { cache: "no-store" })
        const payload = await res.json()

        if (!res.ok) {
          throw new Error(payload?.error || "Failed to fetch messages")
        }

        const serverMessages = normalizeMessages(payload)
        setMessages((prev) => {
          const queued = prev.filter((m) => m.isQueued)
          const queuedMap = new Map(queued.map((m) => [m.info.id, m]))
          const merged = [...serverMessages]
          for (const [id, pending] of queuedMap.entries()) {
            if (!merged.some((m) => m.info.id === id)) {
              merged.push(pending)
            }
          }
          return merged
        })
      } catch (e: any) {
        setError(e?.message || "Failed to fetch messages")
      } finally {
        if (showLoading) setLoadingMessages(false)
      }
    },
    [agentFetch, sessionId]
  )

  const loadSessionRelations = useCallback(async () => {
    if (!sessionId) return

    try {
      const [infoRes, childrenRes] = await Promise.all([
        agentFetch(`/api/agent/session/${sessionId}`, { cache: "no-store" }),
        agentFetch(`/api/agent/session/${sessionId}/children`, { cache: "no-store" }),
      ])

      if (infoRes.ok) {
        const payload = await infoRes.json()
        setSessionInfo(normalizeSession(payload))
      }

      if (childrenRes.ok) {
        const payload = await childrenRes.json()
        setChildSessions(normalizeSessions(payload))
      }
    } catch {
      // Non-blocking in UI.
    }
  }, [agentFetch, sessionId])

  const loadInterrupts = useCallback(async () => {
    if (!sessionId) return

    try {
      const [permissionRes, questionRes] = await Promise.all([
        agentFetch(`/api/agent/permission?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" }),
        agentFetch(`/api/agent/question?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" }),
      ])

      if (permissionRes.ok) {
        const payload = await permissionRes.json()
        setPermissions(normalizePermissions(payload))
      }

      if (questionRes.ok) {
        const payload = await questionRes.json()
        setQuestions(normalizeQuestions(payload))
      }
    } catch {
      // Non-blocking in UI.
    }
  }, [agentFetch, sessionId])

  useEffect(() => {
    if (!sessionId) return
    loadMessages(true)
    loadSessionRelations()
    loadInterrupts()

    const timer = window.setInterval(() => {
      loadMessages(false)
      loadSessionRelations()
      loadInterrupts()
    }, 3000)

    return () => window.clearInterval(timer)
  }, [loadInterrupts, loadMessages, loadSessionRelations, sessionId])

  useEffect(() => {
    let mounted = true

    const run = async () => {
      try {
        const [agentsRes, providersRes] = await Promise.all([
          agentFetch("/api/agent/agents", { cache: "no-store" }),
          agentFetch("/api/agent/providers", { cache: "no-store" }),
        ])

        if (agentsRes.ok) {
          const payload = await agentsRes.json()
          if (!mounted) return
          setAgents(normalizeAgents(payload))
        }

        if (providersRes.ok) {
          const payload = await providersRes.json()
          if (!mounted) return
          const data = normalizeProviders(payload)
          setModels(data.models)

          const storedModel = readModelStorage()
          if (storedModel && data.models.some((m) => m.providerID === storedModel.providerID && m.modelID === storedModel.modelID)) {
            setSelectedModel(storedModel)
          } else if (data.defaultModel) {
            setSelectedModel(data.defaultModel)
          } else if (data.models[0]) {
            setSelectedModel({ providerID: data.models[0].providerID, modelID: data.models[0].modelID })
          }
        }
      } catch {
        // Keep UI functional even if optional metadata endpoints fail.
      }
    }

    run()
    return () => {
      mounted = false
    }
  }, [agentFetch])

  useEffect(() => {
    if (!sessionId || agents.length === 0) return

    const storage = readAgentStorage()
    const stored = storage[sessionId]
    if (stored && agents.some((a) => a.name === stored)) {
      setSelectedAgent(stored)
      return
    }

    const fallback =
      agents.find((a) => a.name === "build")?.name ||
      agents.find((a) => a.name === "plan")?.name ||
      agents[0]?.name ||
      ""
    setSelectedAgent(fallback)
  }, [agents, sessionId])

  useEffect(() => {
    if (!sessionId || !selectedAgent) return
    const storage = readAgentStorage()
    storage[sessionId] = selectedAgent
    saveAgentStorage(storage)
  }, [selectedAgent, sessionId])

  useEffect(() => {
    if (!selectedModel) return
    saveModelStorage(selectedModel)
    // Ensure this model's provider is synced to opencode
    agentFetch("/api/agent/providers/ensure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerPrefix: selectedModel.providerID, modelID: selectedModel.modelID }),
    }).catch(() => { /* non-blocking */ })
  }, [selectedModel, agentFetch])

  // Reset session state when the selected instance changes
  const instanceIdRef = useRef(instance?.id ?? null)
  useEffect(() => {
    const prevId = instanceIdRef.current
    const nextId = instance?.id ?? null
    instanceIdRef.current = nextId

    if (prevId === nextId) return
    // Instance changed — reset everything so a new session is created on the new instance
    setSessionId(null)
    setMessages([])
    setMessageQueue([])
    setPermissions([])
    setQuestions([])
    setSessionInfo(null)
    setChildSessions([])
    setError(null)
  }, [instance?.id])

  useEffect(() => {
    if (questions.length === 0) return
    setQuestionDrafts((prev) => {
      const next = { ...prev }
      for (const request of questions) {
        if (!next[request.id]) {
          next[request.id] = getDefaultQuestionDraft()
        }
      }
      return next
    })
  }, [questions])

  const sendPrompt = useCallback(
    async (messageText: string, tempMessageId: string) => {
      if (!sessionId) return

      try {
        // Ensure model is synced to opencode before sending
        if (selectedModel) {
          await agentFetch("/api/agent/providers/ensure", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ providerPrefix: selectedModel.providerID, modelID: selectedModel.modelID }),
          }).catch(() => { })
        }
        const res = await agentFetch(`/api/agent/session/${sessionId}/prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: messageText,
            agent: selectedAgent || undefined,
            model: selectedModel || undefined,
          }),
        })

        const payload = await res.json()
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to send message")
        }

        await loadMessages(false)
      } catch (e: any) {
        setError(e?.message || "Failed to send message")
        setMessages((prev) => prev.filter((m) => m.info.id !== tempMessageId))
      }
    },
    [agentFetch, loadMessages, selectedAgent, selectedModel, sessionId]
  )

  const processQueue = useCallback(async () => {
    if (!sessionId || isProcessingQueueRef.current || messageQueue.length === 0) return

    isProcessingQueueRef.current = true
    setSending(true)

    try {
      while (true) {
        let next: QueuedMessage | undefined

        setMessageQueue((prev) => {
          if (prev.length === 0) {
            next = undefined
            return prev
          }
          next = prev[0]
          return prev.slice(1)
        })

        await new Promise((resolve) => window.setTimeout(resolve, 0))
        if (!next) break

        setMessages((prev) =>
          prev.map((msg) =>
            msg.info.id === next?.id ? { ...msg, isQueued: false } : msg
          )
        )

        await sendPrompt(next.text, next.id)
      }
    } finally {
      isProcessingQueueRef.current = false
      setSending(false)
    }
  }, [messageQueue.length, sendPrompt, sessionId])

  useEffect(() => {
    if (messageQueue.length > 0) {
      processQueue()
    }
  }, [messageQueue.length, processQueue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !sessionId || isBlockedByDock) return

    const text = input.trim()
    const messageId = `temp-${Date.now()}`
    const shouldQueue = sending || messageQueue.length > 0

    const optimistic: MessageWithParts = {
      info: {
        id: messageId,
        role: "user",
        time: { created: Date.now() },
        agent: "user",
      },
      parts: [{ type: "text", text }],
      isQueued: shouldQueue,
    }

    setMessages((prev) => [...prev, optimistic])
    setMessageQueue((prev) => [...prev, { id: messageId, text }])
    setInput("")
    setError(null)
    isNearBottomRef.current = true
    scrollToBottom("smooth")
  }

  const answerQuestion = async () => {
    if (!activeQuestion || !sessionId) return
    const draft = questionDrafts[activeQuestion.id] || getDefaultQuestionDraft()
    const answers = activeQuestion.questions.map((question, index) => {
      const selected = [...(draft.answers[index] || [])]
      const customEnabled = draft.customEnabled[index] === true && question.custom !== false
      const customValue = (draft.customText[index] || "").trim()

      if (customEnabled && customValue && !selected.includes(customValue)) {
        selected.push(customValue)
      }

      return selected
    })

    if (answers.some((items) => items.length === 0)) {
      setError("請先完成所有問題的回答")
      return
    }

    setRespondingQuestionId(activeQuestion.id)
    try {
      const res = await agentFetch(`/api/agent/question/${activeQuestion.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to reply question")
      }

      await Promise.all([loadInterrupts(), loadMessages(false)])
      setError(null)
    } catch (e: any) {
      setError(e?.message || "Failed to reply question")
    } finally {
      setRespondingQuestionId(null)
    }
  }

  const rejectQuestion = async () => {
    if (!activeQuestion) return

    setRespondingQuestionId(activeQuestion.id)
    try {
      const res = await agentFetch(`/api/agent/question/${activeQuestion.id}/reject`, {
        method: "POST",
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to reject question")
      }

      await Promise.all([loadInterrupts(), loadMessages(false)])
      setError(null)
    } catch (e: any) {
      setError(e?.message || "Failed to reject question")
    } finally {
      setRespondingQuestionId(null)
    }
  }

  const respondPermission = async (reply: "once" | "always" | "reject") => {
    if (!activePermission || !sessionId) return

    setRespondingPermissionId(activePermission.id)
    try {
      const res = await agentFetch(`/api/agent/permission/${activePermission.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reply,
          sessionID: sessionId,
        }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to reply permission")
      }

      await Promise.all([loadInterrupts(), loadMessages(false)])
      setError(null)
    } catch (e: any) {
      setError(e?.message || "Failed to reply permission")
    } finally {
      setRespondingPermissionId(null)
    }
  }

  const updateQuestionOption = (
    requestId: string,
    questionIndex: number,
    label: string,
    multiple: boolean
  ) => {
    setQuestionDrafts((prev) => {
      const current = prev[requestId] || getDefaultQuestionDraft()
      const currentAnswers = current.answers[questionIndex] || []

      let nextAnswers: string[]
      if (multiple) {
        nextAnswers = currentAnswers.includes(label)
          ? currentAnswers.filter((item) => item !== label)
          : [...currentAnswers, label]
      } else {
        nextAnswers = [label]
      }

      return {
        ...prev,
        [requestId]: {
          ...current,
          answers: {
            ...current.answers,
            [questionIndex]: nextAnswers,
          },
          customEnabled: multiple
            ? current.customEnabled
            : {
              ...current.customEnabled,
              [questionIndex]: false,
            },
        },
      }
    })
  }

  const toggleQuestionCustom = (requestId: string, questionIndex: number, enabled: boolean) => {
    setQuestionDrafts((prev) => {
      const current = prev[requestId] || getDefaultQuestionDraft()
      const next: QuestionDraft = {
        ...current,
        customEnabled: {
          ...current.customEnabled,
          [questionIndex]: enabled,
        },
      }

      if (!enabled) {
        const customValue = (current.customText[questionIndex] || "").trim()
        if (customValue) {
          next.answers = {
            ...current.answers,
            [questionIndex]: (current.answers[questionIndex] || []).filter((item) => item !== customValue),
          }
        }
      }

      return {
        ...prev,
        [requestId]: next,
      }
    })
  }

  const updateQuestionCustomText = (requestId: string, questionIndex: number, value: string, multiple: boolean) => {
    setQuestionDrafts((prev) => {
      const current = prev[requestId] || getDefaultQuestionDraft()
      const oldValue = (current.customText[questionIndex] || "").trim()
      const nextValue = value.trim()
      const answers = [...(current.answers[questionIndex] || [])]

      let nextAnswers = answers
      if (oldValue && nextAnswers.includes(oldValue)) {
        nextAnswers = nextAnswers.filter((item) => item !== oldValue)
      }

      if (nextValue && current.customEnabled[questionIndex]) {
        if (multiple) {
          if (!nextAnswers.includes(nextValue)) {
            nextAnswers = [...nextAnswers, nextValue]
          }
        } else {
          nextAnswers = [nextValue]
        }
      }

      return {
        ...prev,
        [requestId]: {
          ...current,
          customText: {
            ...current.customText,
            [questionIndex]: value,
          },
          answers: {
            ...current.answers,
            [questionIndex]: nextAnswers,
          },
        },
      }
    })
  }

  const groupedMessages = useMemo(
    () => messages.filter((msg) => getTextContent(msg.parts) || msg.parts.some(isToolPart)),
    [messages]
  )

  const activeQuestionDraft = activeQuestion ? questionDrafts[activeQuestion.id] || getDefaultQuestionDraft() : null

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/50 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 px-2.5 py-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">一般</span>
              <Switch
                checked
                onCheckedChange={(checked) => {
                  if (checked) return
                  if (onSwitchToNormal) {
                    onSwitchToNormal()
                    return
                  }
                  router.push(`${localePrefix}/chat`)
                }}
                aria-label="切換對話模式"
              />
              <span className="text-[11px] font-medium text-foreground">Agent</span>
            </div>
            <div className="text-sm font-semibold truncate">Agent Mode</div>
            {sessionId && <span className="text-xs text-muted-foreground truncate">{sessionId}</span>}
            <InstanceSelector />
          </div>
          <button
            type="button"
            onClick={createSession}
            disabled={loadingSession}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50"
          >
            {loadingSession ? "建立中..." : "新 Agent Session"}
          </button>
        </div>

        {(sessionInfo?.parentID || childSessions.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {sessionInfo?.parentID && (
              <button
                type="button"
                onClick={() => goToSession(sessionInfo.parentID!)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 hover:bg-muted"
                title={sessionInfo.parentID}
              >
                <ChevronLeft className="h-3 w-3" />
                Parent
              </button>
            )}
            {childSessions.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => goToSession(child.id)}
                className="inline-flex max-w-[280px] items-center gap-1 rounded-full border border-border px-2.5 py-1 hover:bg-muted"
                title={child.id}
              >
                <ArrowUpRight className="h-3 w-3" />
                <span className="truncate">{child.title || child.id}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {loadingMessages && (
          <div className="py-4 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            讀取訊息中...
          </div>
        )}

        {error && (
          <div className="mx-4 mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loadingMessages && groupedMessages.length === 0 && (
          <div className="h-full min-h-[220px] flex items-center justify-center text-muted-foreground text-sm px-4 text-center">
            {loadingSession ? "正在建立 Agent Session..." : "尚無訊息，輸入內容開始與 OpenCode Agent 對話"}
          </div>
        )}

        <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
          {groupedMessages.map((message) => {
            const isAssistant = message.info.role === "assistant"
            const text = getTextContent(message.parts)
            const toolParts = message.parts.filter(isToolPart)

            return (
              <div key={message.info.id} className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[88%] ${isAssistant ? "w-full" : ""}`}>
                  <div className={`flex items-start gap-2 ${isAssistant ? "" : "justify-end"}`}>
                    {isAssistant ? (
                      <Bot className="h-4 w-4 mt-1 text-primary shrink-0" />
                    ) : (
                      <User className="h-4 w-4 mt-1 text-muted-foreground shrink-0 order-2" />
                    )}
                    <div className={`min-w-0 ${isAssistant ? "" : "order-1"}`}>
                      {message.isQueued && (
                        <div className="mb-1 text-[11px] inline-flex rounded-full bg-amber-500/10 text-amber-700 px-2 py-0.5">
                          Queued
                        </div>
                      )}

                      {text && (
                        <div
                          className={
                            isAssistant
                              ? "text-sm leading-7 prose prose-sm dark:prose-invert max-w-none"
                              : "rounded-2xl rounded-br-sm bg-muted px-4 py-2.5 text-sm whitespace-pre-wrap"
                          }
                        >
                          {isAssistant ? (
                            <MessageContent content={text} />
                          ) : (
                            <div className="whitespace-pre-wrap">{text}</div>
                          )}
                        </div>
                      )}

                      {toolParts.length > 0 && (
                        <div className="space-y-2 mt-2">
                          {toolParts.map((part, idx) => {
                            const status = getToolStatus(part)
                            const title = getToolTitle(part)
                            const subtitle = getToolSubtitle(part)
                            const output = getToolOutput(part)
                            const errorText = getToolError(part)
                            const childSessionId = getTaskChildSessionId(part)
                            const inputLines = getToolInputLines(part)
                            const statusClass =
                              status === "completed"
                                ? "text-emerald-700 bg-emerald-500/10"
                                : status === "error"
                                  ? "text-destructive bg-destructive/10"
                                  : status === "running" || status === "pending"
                                    ? "text-amber-700 bg-amber-500/10"
                                    : "text-muted-foreground bg-muted"
                            const running = status === "running" || status === "pending"

                            return (
                              <div
                                key={`${message.info.id}-tool-${idx}`}
                                className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {running ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                                    ) : (
                                      <Wrench className="h-3.5 w-3.5 shrink-0" />
                                    )}
                                    <span className={`font-medium text-foreground truncate ${running ? "animate-pulse" : ""}`}>
                                      {title}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] uppercase ${statusClass}`}>
                                      {status}
                                    </span>
                                  </div>
                                  {childSessionId && (
                                    <button
                                      type="button"
                                      onClick={() => goToSession(childSessionId)}
                                      className="inline-flex items-center gap-1 text-[10px] rounded-md border border-border px-1.5 py-1 hover:bg-background transition-colors shrink-0"
                                      title={`切換到子任務 Session: ${childSessionId}`}
                                    >
                                      <ArrowUpRight className="h-3 w-3" />
                                      subagent
                                    </button>
                                  )}
                                </div>

                                {subtitle && (
                                  <div className="mt-1 text-[11px] text-muted-foreground break-words">
                                    {subtitle}
                                  </div>
                                )}

                                {childSessionId && (
                                  <div className="mt-1 text-[11px] text-muted-foreground/90 break-all">
                                    session: {childSessionId}
                                  </div>
                                )}

                                {inputLines.length > 0 && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                                      input
                                    </summary>
                                    <div className="mt-1 rounded-md border border-border/50 bg-background/60 p-2 space-y-1">
                                      {inputLines.map((line, lineIndex) => (
                                        <div
                                          key={`${message.info.id}-tool-${idx}-line-${lineIndex}`}
                                          className="font-mono text-[11px] break-all"
                                        >
                                          {line}
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}

                                {output && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                                      output
                                    </summary>
                                    <div className="mt-1 rounded-md border border-border/50 bg-background/60 p-2 max-h-[280px] overflow-y-auto prose prose-xs dark:prose-invert max-w-none">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
                                    </div>
                                  </details>
                                )}

                                {errorText && (
                                  <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-destructive break-words">
                                    {errorText}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {sending && (
            <div className="text-xs text-muted-foreground flex items-center gap-2 px-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Agent 正在思考...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-border bg-background p-4 shrink-0">
        <div className="mx-auto max-w-4xl space-y-3">
          {activeQuestion && (
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageCircleQuestion className="h-4 w-4 text-primary" />
                Agent Question
              </div>

              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {activeQuestion.questions.map((question, questionIndex) => {
                  const selected = activeQuestionDraft?.answers[questionIndex] || []
                  const customEnabled = activeQuestionDraft?.customEnabled[questionIndex] === true
                  const customText = activeQuestionDraft?.customText[questionIndex] || ""
                  const multiple = question.multiple === true
                  const allowCustom = question.custom !== false

                  return (
                    <div key={`${activeQuestion.id}-q-${questionIndex}`} className="rounded-lg border border-border/60 p-3 space-y-2">
                      <div className="text-sm font-medium">{question.question}</div>
                      {question.header && <div className="text-xs text-muted-foreground">{question.header}</div>}

                      <div className="grid grid-cols-1 gap-1.5">
                        {question.options.map((option) => {
                          const picked = selected.includes(option.label)
                          return (
                            <button
                              key={`${activeQuestion.id}-q-${questionIndex}-${option.label}`}
                              type="button"
                              onClick={() =>
                                updateQuestionOption(activeQuestion.id, questionIndex, option.label, multiple)
                              }
                              className={`rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${picked
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border hover:bg-muted"
                                }`}
                              disabled={respondingQuestionId === activeQuestion.id}
                            >
                              <div className="font-medium">{option.label}</div>
                              {option.description && (
                                <div className="text-muted-foreground mt-0.5">{option.description}</div>
                              )}
                            </button>
                          )
                        })}
                      </div>

                      {allowCustom && (
                        <div className="rounded-md border border-dashed border-border/70 p-2 space-y-2">
                          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={customEnabled}
                              onChange={(e) =>
                                toggleQuestionCustom(activeQuestion.id, questionIndex, e.target.checked)
                              }
                              disabled={respondingQuestionId === activeQuestion.id}
                            />
                            自訂答案
                          </label>
                          <input
                            value={customText}
                            onChange={(e) =>
                              updateQuestionCustomText(
                                activeQuestion.id,
                                questionIndex,
                                e.target.value,
                                multiple
                              )
                            }
                            disabled={!customEnabled || respondingQuestionId === activeQuestion.id}
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs disabled:opacity-60"
                            placeholder="輸入自訂答案"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={rejectQuestion}
                  disabled={respondingQuestionId === activeQuestion.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={answerQuestion}
                  disabled={respondingQuestionId === activeQuestion.id}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {respondingQuestionId === activeQuestion.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Submit Answers
                </button>
              </div>
            </div>
          )}

          {activePermission && (
            <div className="rounded-xl border border-amber-300/50 bg-amber-50/40 dark:bg-amber-500/5 p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                Permission Request
              </div>

              <div className="text-xs text-muted-foreground break-words">
                permission: <span className="font-medium text-foreground">{activePermission.permission}</span>
              </div>

              {activePermission.patterns.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {activePermission.patterns.map((pattern) => (
                    <code
                      key={`${activePermission.id}-${pattern}`}
                      className="rounded bg-background px-2 py-1 text-[11px]"
                    >
                      {pattern}
                    </code>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => respondPermission("reject")}
                  disabled={respondingPermissionId === activePermission.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Deny
                </button>
                <button
                  type="button"
                  onClick={() => respondPermission("always")}
                  disabled={respondingPermissionId === activePermission.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                >
                  Always Allow
                </button>
                <button
                  type="button"
                  onClick={() => respondPermission("once")}
                  disabled={respondingPermissionId === activePermission.id}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {respondingPermissionId === activePermission.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Allow Once
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-12 shrink-0">Agent</span>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">No agent (use model)</option>
                  {agents.map((agent) => (
                    <option key={agent.name} value={agent.name}>
                      {agent.name}
                      {agent.description ? ` - ${agent.description}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-12 shrink-0">Model</span>
                <select
                  value={selectedModelKey}
                  onChange={(e) => {
                    const value = e.target.value
                    const [providerID, ...rest] = value.split("/")
                    const modelID = rest.join("/")
                    if (!providerID || !modelID) {
                      setSelectedModel(null)
                      return
                    }
                    setSelectedModel({ providerID, modelID })
                  }}
                  disabled={!!selectedAgent || models.length === 0}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                >
                  <option value="">Select model</option>
                  {models.map((model) => (
                    <option key={model.key} value={model.key}>
                      {model.providerName} / {model.modelName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-2.5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    handleSubmit(e as unknown as React.FormEvent)
                  }
                }}
                placeholder={
                  isBlockedByDock
                    ? "請先完成上方 permission/question"
                    : "輸入訊息，將送到 OpenCode agent..."
                }
                className="w-full min-h-[88px] resize-none bg-transparent px-2 py-1.5 text-sm leading-6 outline-none"
                disabled={!sessionId || loadingSession || isBlockedByDock}
              />
              <div className="flex justify-between items-center gap-2">
                <div className="text-[11px] text-muted-foreground px-1">
                  {isBlockedByDock
                    ? "Blocked: waiting for permission/question response"
                    : "Enter 送出，Shift+Enter 換行"}
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || !sessionId || loadingSession || isBlockedByDock}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  送出
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
