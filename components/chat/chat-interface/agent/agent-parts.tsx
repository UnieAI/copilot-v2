"use client"

import { useMemo } from "react"
import type { Part, ToolPart } from "./types"
import { CONTEXT_GROUP_TOOLS, HIDDEN_TOOLS } from "./tool-cards"
import { ContextGroup } from "./context-group"
import { BashTool } from "./tool-cards/bash-tool"
import { EditTool } from "./tool-cards/edit-tool"
import { WriteTool } from "./tool-cards/write-tool"
import { ReadTool } from "./tool-cards/read-tool"
import { GlobTool } from "./tool-cards/glob-tool"
import { GrepTool } from "./tool-cards/grep-tool"
import { WebfetchTool } from "./tool-cards/webfetch-tool"
import { TaskTool } from "./tool-cards/task-tool"
import { PatchTool } from "./tool-cards/patch-tool"
import { SkillTool } from "./tool-cards/skill-tool"
import { GenericTool } from "./tool-cards/generic-tool"
import type { ToolCardProps } from "./tool-cards"
import { MessageContent } from "../markdown-components"
import { Brain, ChevronUp, ChevronDown, Loader2, AlertTriangle } from "lucide-react"
import { useState } from "react"

const TOOL_REGISTRY: Record<string, React.ComponentType<ToolCardProps>> = {
  bash: BashTool,
  edit: EditTool,
  write: WriteTool,
  read: ReadTool,
  glob: GlobTool,
  grep: GrepTool,
  webfetch: WebfetchTool,
  task: TaskTool,
  agent: TaskTool,
  apply_patch: PatchTool,
  skill: SkillTool,
}

function isContextGroupTool(part: Part): part is ToolPart {
  return part.type === "tool" && CONTEXT_GROUP_TOOLS.has(part.tool)
}

function isRenderable(part: Part): boolean {
  if (part.type === "tool") {
    if (HIDDEN_TOOLS.has(part.tool)) return false
    if (
      part.tool === "question" &&
      (part.state.status === "pending" || part.state.status === "running")
    )
      return false
    return true
  }
  if (part.type === "text") return !!(part.text?.trim())
  if (part.type === "reasoning") return !!(part.text?.trim())
  if (part.type === "retry") return true
  return false
}

type GroupedItem =
  | { type: "part"; part: Part; key: string }
  | { type: "context"; parts: ToolPart[]; key: string }

export function AgentParts({
  parts,
  isBusy = false,
  onOpenSubAgent,
}: {
  parts: Part[]
  isBusy?: boolean
  onOpenSubAgent?: (sessionId: string) => void
}) {
  const grouped = useMemo(() => {
    const items: GroupedItem[] = []
    const renderableParts = parts.filter(isRenderable)
    let contextStart = -1

    const flush = (end: number) => {
      if (contextStart < 0) return
      const contextParts = renderableParts
        .slice(contextStart, end + 1)
        .filter((p): p is ToolPart => isContextGroupTool(p))
      if (contextParts.length > 0) {
        items.push({
          type: "context",
          parts: contextParts,
          key: `ctx:${contextParts[0].id}`,
        })
      }
      contextStart = -1
    }

    renderableParts.forEach((part, index) => {
      if (isContextGroupTool(part)) {
        if (contextStart < 0) contextStart = index
        return
      }
      flush(index - 1)
      items.push({ type: "part", part, key: `part:${part.id}` })
    })
    flush(renderableParts.length - 1)

    return items
  }, [parts])

  return (
    <div className="space-y-1">
      {grouped.map((item, idx) => {
        const isLast = idx === grouped.length - 1
        if (item.type === "context") {
          return (
            <ContextGroup
              key={item.key}
              parts={item.parts}
              busy={isBusy && isLast}
            />
          )
        }
        return (
          <PartRenderer
            key={item.key}
            part={item.part}
            onOpenSubAgent={onOpenSubAgent}
          />
        )
      })}
    </div>
  )
}

function PartRenderer({
  part,
  onOpenSubAgent,
}: {
  part: Part
  onOpenSubAgent?: (sessionId: string) => void
}) {
  switch (part.type) {
    case "text":
      return <TextPartDisplay text={part.text} />
    case "reasoning":
      return <ReasoningPartDisplay text={part.text} />
    case "tool": {
      const Component = TOOL_REGISTRY[part.tool] || GenericTool
      return <Component part={part} onOpenSubAgent={onOpenSubAgent} />
    }
    case "retry":
      return <RetryPartDisplay attempt={part.attempt} />
    default:
      return null
  }
}

function TextPartDisplay({ text }: { text: string }) {
  if (!text.trim()) return null
  return (
    <div className="prose-container px-1">
      <MessageContent content={text} />
    </div>
  )
}

function ReasoningPartDisplay({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!text.trim()) return null

  return (
    <div className="my-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-fit flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
      >
        <Brain className="h-3.5 w-3.5 text-muted-foreground/70" />
        <span>Thinking</span>
        {expanded ? (
          <ChevronUp className="h-3 w-3 opacity-50" />
        ) : (
          <ChevronDown className="h-3 w-3 opacity-50" />
        )}
      </button>
      {expanded && (
        <div className="pl-4 ml-[7px] border-l-2 border-border/60 text-[13px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed mt-2">
          {text.trim()}
        </div>
      )}
    </div>
  )
}

function RetryPartDisplay({ attempt }: { attempt: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400">
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>Retrying (attempt {attempt})...</span>
    </div>
  )
}
