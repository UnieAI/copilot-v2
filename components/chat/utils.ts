import {
    AgentMessage,
    AgentModelOption,
    AgentSelectedModel,
    AgentToolCall,
    UIMessage,
    AgentTextPart,
    AgentReasoningPart,
    AgentToolPart,
    TodoItem
} from "./types"

export const ACCEPTED_IMAGE_TYPES = ".jpg,.jpeg,.png"
export const ACCEPTED_DOC_TYPES = ".pdf,.doc,.docx,.csv,.txt,.md,.json,.js,.jsx,.ts,.tsx,.html,.css,.py"
export const SYSTEM_PROMPT_STORAGE_KEY = "chat:systemPrompt"
export const AGENT_MODEL_STORAGE_KEY = "opencode-selected-model"

export function toRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
    return value as Record<string, unknown>
}

export function toAgentMessages(payload: any): AgentMessage[] {
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.data)) return payload.data
    if (Array.isArray(payload?.messages)) return payload.messages
    return []
}

export function normalizeAgentProviders(payload: any): { models: AgentModelOption[]; defaultModel: AgentSelectedModel | null } {
    const root = payload?.providers
        ? payload
        : payload?.data?.providers
            ? payload.data
            : payload

    const providers = Array.isArray(root?.providers) ? root.providers : []
    const defaults = typeof root?.default === "object" && root?.default ? root.default : {}
    const models: AgentModelOption[] = []

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
            models.push({
                key: `${providerID}/${modelID}`,
                providerID,
                providerName,
                modelID,
                modelName: String(model?.name || modelID),
            })
        }
    }

    let defaultModel: AgentSelectedModel | null = null
    for (const [providerID, modelID] of Object.entries(defaults as Record<string, string>)) {
        if (modelID) {
            defaultModel = { providerID, modelID }
            break
        }
    }

    return { models, defaultModel }
}

export function readAgentModelStorage(): AgentSelectedModel | null {
    if (typeof window === "undefined") return null
    try {
        const raw = window.localStorage.getItem(AGENT_MODEL_STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (parsed?.providerID && parsed?.modelID) {
            return { providerID: String(parsed.providerID), modelID: String(parsed.modelID) }
        }
    } catch {
    }
    return null
}

export function saveAgentModelStorage(model: AgentSelectedModel) {
    if (typeof window === "undefined") return
    try {
        window.localStorage.setItem(AGENT_MODEL_STORAGE_KEY, JSON.stringify(model))
    } catch {
    }
}

export function getToolStatus(status: string): AgentToolCall["status"] {
    if (status === "pending" || status === "running" || status === "completed" || status === "error") {
        return status
    }
    return "unknown"
}

export function stringifyValue(value: unknown) {
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

export function extractSessionIdFromTaskOutput(output: string): string {
    if (!output) return ""
    const direct = output.match(/task_id:\s*([A-Za-z0-9_-]+)/i)
    if (direct?.[1]) return direct[1]
    const quoted = output.match(/["']task_id["']\s*:\s*["']([A-Za-z0-9_-]+)["']/i)
    if (quoted?.[1]) return quoted[1]
    return ""
}

export function extractAgentToolCall(part: AgentToolPart, index: number): AgentToolCall {
    const status = getToolStatus(String(part.state?.status || "").toLowerCase())
    const tool = String(part.tool || "tool")
    const input = toRecord(part.state?.input) || {}
    const stateMeta = toRecord(part.state?.metadata) || {}
    const partMeta = toRecord(part.metadata) || {}
    const stateTitle = typeof part.state?.title === "string" ? part.state.title : ""
    const subtitle =
        stateTitle ||
        (typeof input.description === "string" ? input.description : "") ||
        (typeof input.filePath === "string" ? input.filePath : "") ||
        (typeof input.path === "string" ? input.path : "") ||
        (typeof input.url === "string" ? input.url : "")
    const title = tool === "task"
        ? `agent · ${typeof input.subagent_type === "string" && input.subagent_type ? input.subagent_type : "task"}`
        : tool
    const output =
        (typeof part.state?.output === "string" && part.state.output) ||
        (typeof part.state?.raw === "string" && part.state.raw) ||
        ""
    const error = typeof part.state?.error === "string" ? part.state.error : ""
    const childSessionId =
        (typeof stateMeta.sessionId === "string" && stateMeta.sessionId) ||
        (typeof stateMeta.sessionID === "string" && stateMeta.sessionID) ||
        (typeof partMeta.sessionId === "string" && partMeta.sessionId) ||
        (typeof partMeta.sessionID === "string" && partMeta.sessionID) ||
        (typeof input.sessionId === "string" && input.sessionId) ||
        (typeof input.sessionID === "string" && input.sessionID) ||
        (typeof input.task_id === "string" && input.task_id) ||
        extractSessionIdFromTaskOutput(output) ||
        ""

    const inputLines = Object.entries(input)
        .filter(([key]) => key !== "description")
        .map(([key, value]) => {
            const raw = stringifyValue(value)
            const text = raw.length > 220 ? `${raw.slice(0, 220)}...` : raw
            return `${key}: ${text}`
        })

    return {
        id: `${tool}-${index}`,
        tool,
        status,
        title,
        subtitle,
        inputLines,
        input,
        output,
        error,
        childSessionId: childSessionId || undefined,
    }
}

export function parseTodoJson(text: string): TodoItem[] {
    if (!text.trim()) return []
    const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```$/i, "")
        .trim()
    try {
        const parsed = JSON.parse(cleaned)
        if (!Array.isArray(parsed)) return []
        return parsed
            .map((item) => {
                const row = toRecord(item)
                if (!row) return null
                const content = typeof row.content === "string" ? row.content.trim() : ""
                if (!content) return null
                return {
                    content,
                    status: typeof row.status === "string" ? row.status : "pending",
                    priority: typeof row.priority === "string" ? row.priority : "medium",
                } as TodoItem
            })
            .filter(Boolean) as TodoItem[]
    } catch {
        return []
    }
}

export function resolveTodoItems(call: AgentToolCall): TodoItem[] {
    if (call.tool !== "todowrite" && call.tool !== "todoread") return []
    const inputTodos = call.input?.todos
    if (Array.isArray(inputTodos)) {
        const fromInput = inputTodos
            .map((item) => {
                const row = toRecord(item)
                if (!row) return null
                const content = typeof row.content === "string" ? row.content.trim() : ""
                if (!content) return null
                return {
                    content,
                    status: typeof row.status === "string" ? row.status : "pending",
                    priority: typeof row.priority === "string" ? row.priority : "medium",
                } as TodoItem
            })
            .filter(Boolean) as TodoItem[]
        if (fromInput.length > 0) return fromInput
    }
    return parseTodoJson(call.output)
}

export function buildActiveToolLabel(calls: AgentToolCall[]) {
    const running = calls.find((call) => call.status === "running" || call.status === "pending")
    if (!running) return ""
    if (running.subtitle) return `${running.title} · ${running.subtitle}`
    return running.title
}

export function toUIAgentMessages(payload: any): UIMessage[] {
    return toAgentMessages(payload).map((message, index) => {
        const info = message.info || {}
        const id = String(info.id || message.id || `agent-${index}`)
        const rawRole = String(info.role || message.role || "assistant")
        const role: UIMessage["role"] =
            rawRole === "user" || rawRole === "assistant" || rawRole === "system"
                ? rawRole
                : "assistant"
        const parts = Array.isArray(message.parts) ? message.parts : []

        const textBlocks = parts
            .map((part) => {
                if ((part as AgentTextPart)?.type === "text") {
                    const text = (part as AgentTextPart).text
                    return typeof text === "string" ? text : ""
                }
                if ((part as AgentReasoningPart)?.type === "reasoning") {
                    const text = (part as AgentReasoningPart).text
                    return typeof text === "string" && text ? `<think>${text}</think>` : ""
                }
                return ""
            })
            .filter(Boolean)
        const toolCalls = parts
            .filter((part) => (part as AgentToolPart)?.type === "tool")
            .map((part, partIndex) => extractAgentToolCall(part as AgentToolPart, partIndex))

        const hasRunningTool = toolCalls.some((toolCall) => toolCall.status === "pending" || toolCall.status === "running")
        const hasStepFinish = parts.some((part) => (part as { type?: string })?.type === "step-finish")
        const finish = typeof info.finish === "string" ? info.finish : (typeof message.finish === "string" ? message.finish : "")
        const isFinished = !!finish || hasStepFinish
        const hasAssistantContent = textBlocks.length > 0 || toolCalls.length > 0

        return {
            id,
            dbId: id,
            role,
            content: textBlocks.join("\n\n"),
            isStreaming: role === "assistant" ? (hasRunningTool || (hasAssistantContent && !isFinished)) : false,
            agentToolCalls: toolCalls,
        }
    })
}

export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
    })
}
