"use client"

import { useMemo } from "react"
import type { AgentPart, AgentToolPart } from "@/lib/agent/types"
import { isContextTool, getToolInfo } from "@/lib/agent/tool-info"
import { normalizeToolStatus } from "@/lib/agent/tool-status"
import { ContextGroup } from "./tool-call/context-group"
import { BashTool } from "./tool-call/bash-tool"
import { EditTool } from "./tool-call/edit-tool"
import { TaskTool } from "./tool-call/task-tool"
import { TodoWriteTool } from "./tool-call/todo-write-tool"
import { ToolCard } from "./tool-call/tool-card"
import { StreamingText } from "./streaming-text"
import { AgentProgressTicker } from "./agent-progress-ticker"

type GroupedItem =
  | { kind: "text"; part: { id: string; text: string } }
  | { kind: "reasoning"; part: { id: string; text: string } }
  | { kind: "context-group"; tools: AgentToolPart[] }
  | { kind: "tool"; part: AgentToolPart }

function groupParts(parts: AgentPart[]): GroupedItem[] {
  const result: GroupedItem[] = []
  let contextBuffer: AgentToolPart[] = []

  const flushContext = () => {
    if (contextBuffer.length > 0) {
      result.push({ kind: "context-group", tools: [...contextBuffer] })
      contextBuffer = []
    }
  }

  for (const part of parts) {
    if (part.type === "text") {
      flushContext()
      result.push({ kind: "text", part })
    } else if (part.type === "reasoning") {
      flushContext()
      result.push({ kind: "reasoning", part })
    } else if (part.type === "tool") {
      const toolName = (part.tool || "").toLowerCase()
      if (isContextTool(toolName)) {
        contextBuffer.push(part)
      } else {
        flushContext()
        result.push({ kind: "tool", part })
      }
    } else if (part.type === "step-finish") {
      flushContext()
      // step-finish is structural, no visual rendering needed
    }
  }

  flushContext()
  return result
}

export function AgentPartsRenderer({
  parts,
  isBusy,
  localePrefix,
  onOpenSubAgent,
}: {
  parts: AgentPart[]
  isBusy: boolean
  localePrefix: string
  onOpenSubAgent?: (childSessionId: string) => void
}) {
  const grouped = useMemo(() => groupParts(parts), [parts])

  return (
    <div className="space-y-2">
      {grouped.map((item, idx) => {
        switch (item.kind) {
          case "text":
            return (
              <StreamingText
                key={item.part.id}
                text={item.part.text}
                isBusy={isBusy && idx === grouped.length - 1}
              />
            )

          case "reasoning":
            return (
              <ReasoningBlock
                key={item.part.id}
                text={item.part.text}
                isBusy={isBusy}
              />
            )

          case "context-group":
            return (
              <ContextGroup
                key={`ctx-${item.tools[0]?.id || idx}`}
                tools={item.tools}
              />
            )

          case "tool": {
            const toolName = (item.part.tool || "").toLowerCase()

            if (toolName === "bash") {
              return <BashTool key={item.part.id} part={item.part} />
            }

            if (toolName === "edit" || toolName === "write" || toolName === "notebookedit") {
              return <EditTool key={item.part.id} part={item.part} />
            }

            if (toolName === "task" || toolName === "agent") {
              return (
                <TaskTool
                  key={item.part.id}
                  part={item.part}
                  localePrefix={localePrefix}
                  onOpenSubAgent={onOpenSubAgent}
                />
              )
            }

            if (toolName === "todowrite") {
              return <TodoWriteTool key={item.part.id} part={item.part} />
            }

            // Default generic tool card
            const info = getToolInfo(item.part)
            const status = normalizeToolStatus(item.part.state?.status)
            return <ToolCard key={item.part.id} info={info} status={status} />
          }
        }
      })}
      {isBusy && (
        <AgentProgressTicker className="pt-1" />
      )}
    </div>
  )
}

// ─── Reasoning Block ─────────────────────────────────────────────────

import { useState } from "react"
import { Brain, ChevronUp, ChevronDown, Loader2 } from "lucide-react"

function ReasoningBlock({ text, isBusy }: { text: string; isBusy: boolean }) {
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null)
  const expanded = userExpanded !== null ? userExpanded : isBusy

  return (
    <div className="my-2 flex flex-col gap-2">
      <button
        onClick={() => setUserExpanded(!expanded)}
        className="w-fit flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
      >
        {isBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/70" />
        ) : (
          <Brain className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
        )}
        <span>Thinking</span>
        {expanded ? <ChevronUp className="h-3 w-3 opacity-50" /> : <ChevronDown className="h-3 w-3 opacity-50" />}
      </button>
      {expanded && (
        <div className="pl-4 ml-[7px] border-l-2 border-border/60 text-[13px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed animate-in fade-in slide-in-from-top-1 duration-300">
          {text.trim()}
        </div>
      )}
    </div>
  )
}
