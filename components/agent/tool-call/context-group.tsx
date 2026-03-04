"use client"

import { useState } from "react"
import { Eye, ChevronDown, Loader2, Check } from "lucide-react"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { TextShimmer } from "./text-shimmer"
import { cn } from "@/lib/utils"
import type { AgentToolPart, ToolStatus } from "@/lib/agent/types"
import { getToolInfo } from "@/lib/agent/tool-info"
import { normalizeToolStatus } from "@/lib/agent/tool-status"

function summarize(tools: AgentToolPart[]): string {
  const counts: Record<string, number> = {}
  for (const t of tools) {
    const name = (t.tool || "tool").toLowerCase()
    counts[name] = (counts[name] || 0) + 1
  }
  return Object.entries(counts)
    .map(([name, count]) => `${count} ${name}${count > 1 ? "s" : ""}`)
    .join(", ")
}

function groupStatus(tools: AgentToolPart[]): ToolStatus {
  const statuses = tools.map((t) => normalizeToolStatus(t.state?.status))
  if (statuses.some((s) => s === "error")) return "error"
  if (statuses.some((s) => s === "running" || s === "pending")) return "running"
  return "completed"
}

export function ContextGroup({ tools }: { tools: AgentToolPart[] }) {
  const [open, setOpen] = useState(false)
  const status = groupStatus(tools)
  const isActive = status === "running" || status === "pending"
  const summary = summarize(tools)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-border/40 bg-card/30 transition-colors">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm hover:bg-muted/20 transition-colors rounded-xl">
            {isActive ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500 shrink-0" />
            ) : (
              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            )}
            <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <TextShimmer active={isActive} className="text-[13px] font-medium text-foreground">
                {isActive ? "Gathering context..." : "Gathered context"}
              </TextShimmer>
              <span className="text-xs text-muted-foreground ml-2">{summary}</span>
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground/50 transition-transform shrink-0",
                open && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-2 space-y-1 border-t border-border/20">
            {tools.map((tool) => {
              const info = getToolInfo(tool)
              const s = normalizeToolStatus(tool.state?.status)
              const isToolActive = s === "running" || s === "pending"
              return (
                <div
                  key={tool.id}
                  className="flex items-center gap-2 py-1 text-xs text-muted-foreground"
                >
                  {isToolActive ? (
                    <Loader2 className="h-3 w-3 animate-spin text-amber-500 shrink-0" />
                  ) : s === "error" ? (
                    <span className="h-3 w-3 text-destructive shrink-0">!</span>
                  ) : (
                    <Check className="h-3 w-3 text-emerald-500/70 shrink-0" />
                  )}
                  <span className="font-mono truncate">{info.title}</span>
                  {info.subtitle && (
                    <span className="truncate opacity-60">{info.subtitle}</span>
                  )}
                </div>
              )
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
