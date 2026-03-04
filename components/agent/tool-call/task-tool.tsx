"use client"

import { ArrowUpRight } from "lucide-react"
import { ToolCard } from "./tool-card"
import type { AgentToolPart } from "@/lib/agent/types"
import { getToolInfo } from "@/lib/agent/tool-info"
import { normalizeToolStatus } from "@/lib/agent/tool-status"

export function TaskTool({
  part,
  localePrefix,
  onOpenSubAgent,
}: {
  part: AgentToolPart
  localePrefix: string
  onOpenSubAgent?: (childSessionId: string) => void
}) {
  const info = getToolInfo(part)
  const status = normalizeToolStatus(part.state?.status)

  return (
    <ToolCard info={info} status={status}>
      {info.subtitle && (
        <p className="mt-2 text-xs text-muted-foreground">{info.subtitle}</p>
      )}
      {info.childSessionId && (
        <button
          onClick={() => onOpenSubAgent?.(info.childSessionId!)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors underline underline-offset-2"
        >
          Open sub-agent session
          <ArrowUpRight className="h-3 w-3" />
        </button>
      )}
    </ToolCard>
  )
}
