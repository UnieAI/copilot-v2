"use client"

import type React from "react"
import { AutoResizeTextarea } from "@/components/shared/auto-resize-textarea"
import { Send, User } from "lucide-react"

interface Props {
  isWaitingForUser: boolean
  userInput: string
  setUserInput: React.Dispatch<React.SetStateAction<string>>
  handleUserSubmit: () => void
}

export const UserInput = ({ isWaitingForUser, userInput, setUserInput, handleUserSubmit }: Props) => {
  return (
    <div className="flex-shrink-0 rounded bg-white dark:bg-zinc-900 shadow-[0_-4px_10px_0_rgba(0,0,0,0.2)]">
      <div className="p-2">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-8 h-8 rounded-full overflow-hidden flex items-center justify-center hover:scale-110 duration-150 bg-zinc-100 dark:bg-zinc-800">
              <User className="w-5 h-5 text-zinc-600" />
            </div>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">You</p>
          </div>
          <div className="relative flex-1">
            <AutoResizeTextarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (e.shiftKey) {
                    // Shift+Enter 換行
                    return
                  } else {
                    // Enter 送出訊息
                    e.preventDefault() // 防止預設換行
                    handleUserSubmit() // 送出訊息
                  }
                }
              }}
              placeholder="輸入您的訊息..."
              className="w-full min-h-[48px] max-h-32 px-4 py-3 pr-12 border border-zinc-300 rounded-lg resize-none"
            />
            <button
              onClick={handleUserSubmit}
              disabled={!userInput.trim() || !isWaitingForUser}
              className="absolute bottom-3 right-3 flex items-center justify-center w-6 h-6 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
