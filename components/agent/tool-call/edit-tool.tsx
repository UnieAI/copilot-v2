"use client"

import { ToolCard } from "./tool-card"
import type { AgentToolPart } from "@/lib/agent/types"
import { getToolInfo } from "@/lib/agent/tool-info"
import { normalizeToolStatus } from "@/lib/agent/tool-status"

function DiffView({ oldStr, newStr }: { oldStr: string; newStr: string }) {
  const oldLines = oldStr.split("\n")
  const newLines = newStr.split("\n")

  return (
    <div className="mt-2 rounded-md border border-border/50 bg-background/80 overflow-hidden">
      <div className="px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground border-b border-border/30 bg-muted/30">
        Diff
      </div>
      <div className="font-mono text-[11px] max-h-[300px] overflow-y-auto">
        {oldLines.map((line, i) => (
          <div key={`old-${i}`} className="px-2.5 py-0.5 bg-red-500/10 text-red-700 dark:text-red-400">
            <span className="select-none opacity-50 mr-2">-</span>
            {line}
          </div>
        ))}
        {newLines.map((line, i) => (
          <div key={`new-${i}`} className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <span className="select-none opacity-50 mr-2">+</span>
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}

export function EditTool({ part }: { part: AgentToolPart }) {
  const info = getToolInfo(part)
  const status = normalizeToolStatus(part.state?.status)
  const input = part.state?.input || {}
  const oldStr = typeof input.oldString === "string" ? input.oldString : ""
  const newStr = typeof input.newString === "string" ? input.newString : ""
  const content = typeof input.content === "string" ? input.content : ""
  const tool = (part.tool || "").toLowerCase()
  const hasDiff = tool === "edit" && (oldStr || newStr)

  return (
    <ToolCard info={info} status={status}>
      {hasDiff && <DiffView oldStr={oldStr} newStr={newStr} />}
      {tool === "write" && content && (
        <div className="mt-2 rounded-md border border-border/50 bg-background/80 overflow-hidden">
          <div className="px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground border-b border-border/30 bg-muted/30">
            Content ({content.split("\n").length} lines)
          </div>
          <pre className="px-2.5 py-2 text-[11px] font-mono text-foreground/90 whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
            {content.length > 2000 ? content.slice(0, 2000) + "\n..." : content}
          </pre>
        </div>
      )}
    </ToolCard>
  )
}
