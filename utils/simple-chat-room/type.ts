export interface ChatMessage {
  id: string
  content: string
  reason: string
  timestamp: Date
  isUser: boolean
  isWaiting?: boolean
}
