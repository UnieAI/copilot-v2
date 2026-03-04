import type { AgentPart } from "@/lib/agent/types"

export type Attachment = {
    name: string
    mimeType: string
    base64: string
    previewUrl?: string
}

export type DBMessage = {
    id: string
    role: "user" | "assistant" | "system"
    content: string
    attachments?: { name: string; mimeType: string; base64?: string }[]
    createdAt: string
}

export type UIMessage = {
    id: string
    dbId?: string
    role: "user" | "assistant" | "system"
    content: string
    attachments?: { name: string; mimeType: string; base64?: string }[]
    isStreaming?: boolean
    agentToolCalls?: AgentToolCall[]
}

export type AgentTextPart = {
    type: "text"
    text: string
}

export type AgentReasoningPart = {
    type: "reasoning"
    text: string
}

export type AgentToolPart = {
    type: "tool"
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

export type AgentMessage = {
    info?: {
        id?: string
        role?: string
        finish?: string
    }
    id?: string
    role?: string
    finish?: string
    parts?: Array<AgentTextPart | AgentReasoningPart | AgentToolPart | Record<string, unknown>>
}

export type AgentToolCall = {
    id: string
    tool: string
    status: "pending" | "running" | "completed" | "error" | "unknown"
    title: string
    subtitle: string
    inputLines: string[]
    input?: Record<string, unknown>
    output: string
    error: string
    childSessionId?: string
}

export type AgentSelectedModel = {
    providerID: string
    modelID: string
}

export type AgentModelOption = {
    key: string
    providerID: string
    providerName: string
    modelID: string
    modelName: string
}

export type TodoItem = {
    content: string
    status: "pending" | "in_progress" | "completed" | "cancelled" | string
    priority: "high" | "medium" | "low" | string
}

export type AvailableModel = {
    value: string      // "{prefix}-{modelId}"
    label: string      // modelId only
    providerName: string
    providerPrefix: string
    source?: 'user' | 'group' | 'global'
    groupId?: string
    groupName?: string
}
