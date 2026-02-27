
import { CharacterType } from "../character/type"

export interface CharacterChatType {
  CharacterType: CharacterType
  temp_user?: boolean // 特殊標記，用於識別臨時角色
  use_motion?: boolean // 回應是否可以包含動作
}

export interface ChatroomPromptSettings {
  scene: string
  topic: string
  tone: string
  objective: string
  style: string
}

export interface ChatMessage {
  id: string
  characterId: string
  character: CharacterChatType
  content: string
  reason: string
  timestamp: Date
  isUser: boolean
  isWaiting?: boolean // 新增：標記是否正在等待第一個token
}
