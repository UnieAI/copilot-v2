
export interface Model {
    id: string
    object: string
    created?: number
    owned_by?: string
}

export interface ApiSettings {
    apiUrl: string
    apiKey: string
    selectedModel: string
}
