"use client"

import { ToolCard } from "./tool-card"
import type { AgentToolPart } from "@/lib/agent/types"
import { getToolInfo } from "@/lib/agent/tool-info"
import { normalizeToolStatus } from "@/lib/agent/tool-status"

export function BashTool({ part }: { part: AgentToolPart }) {
  const info = getToolInfo(part)
  const status = normalizeToolStatus(part.state?.status)
  const command = String(part.state?.input?.command || part.state?.input?.cmd || "")

  return (
    <ToolCard info={info} status={status}>
      {command && (
        <div className="mt-2 rounded-md border border-border/50 bg-background/80 overflow-hidden">
          <div className="px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground border-b border-border/30 bg-muted/30">
            Command
          </div>
          <pre className="px-2.5 py-2 text-[11px] font-mono text-foreground/90 whitespace-pre-wrap break-all overflow-x-auto max-h-[200px] overflow-y-auto">
            {command}
          </pre>
        </div>
      )}
    </ToolCard>
  )
}
