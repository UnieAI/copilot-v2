
export interface Message {
  role: "system" | "user" | "assistant"
  content: string
}

export interface ParsedContent {
  content: string; // markdown 處理後、移除 <think> 的主內容
  reason: string;  // markdown 處理後的 think 區塊內容
}
