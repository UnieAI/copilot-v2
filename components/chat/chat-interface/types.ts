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

export const ACCEPTED_IMAGE_TYPES = ".jpg,.jpeg,.png"
export const ACCEPTED_DOC_TYPES = ".pdf,.doc,.docx,.csv,.txt,.md,.json,.js,.jsx,.ts,.tsx,.html,.css,.py"
