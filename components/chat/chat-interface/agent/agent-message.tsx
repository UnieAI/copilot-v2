"use client"

import { RefreshCw } from "lucide-react"
import type { Message, Part, TextPart } from "./types"
import { AgentParts } from "./agent-parts"

export function AgentMessage({
  message,
  parts,
  isBusy = false,
  onOpenSubAgent,
  onRegenerate,
}: {
  message: Message
  parts: Part[]
  isBusy?: boolean
  onOpenSubAgent?: (sessionId: string) => void
  onRegenerate?: (messageId: string) => void
}) {
  if (message.role === "user") {
    return <UserMessageDisplay parts={parts} />
  }

  return (
    <div className="py-1">
      <AgentParts
        parts={parts}
        isBusy={isBusy}
        onOpenSubAgent={onOpenSubAgent}
      />
      {onRegenerate && !isBusy && (
        <div className="flex justify-start mt-1">
          <button
            onClick={() => onRegenerate(message.id)}
            className="flex items-center gap-1.5 px-1.5 py-1.5 text-xs font-medium rounded-full hover:bg-muted/60 transition-colors text-muted-foreground"
            title="重新生成"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

function UserMessageDisplay({ parts }: { parts: Part[] }) {
  const textPart = parts.find(
    (p) => p.type === "text" && !(p as TextPart).synthetic,
  ) as TextPart | undefined
  const text = textPart?.text || ""

  if (!text) return null

  return (
    <div className="flex justify-end mb-2">
      <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-primary text-primary-foreground text-sm leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </div>
  )
}
