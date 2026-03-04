"use client"

import { useState, useEffect } from "react"
import {
  Terminal, Eye, FileCode, Search, GitBranch, Wrench, FileText, List,
  ChevronDown, Loader2, Check, X,
} from "lucide-react"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { TextShimmer } from "./text-shimmer"
import { cn } from "@/lib/utils"
import type { ToolStatus } from "@/lib/agent/types"
import type { ToolIcon, ToolInfo } from "@/lib/agent/tool-info"

const ICON_MAP: Record<ToolIcon, React.ComponentType<{ className?: string }>> = {
  terminal: Terminal,
  eye: Eye,
  "file-code": FileCode,
  search: Search,
  "git-branch": GitBranch,
  wrench: Wrench,
  "file-text": FileText,
  list: List,
}

function StatusIndicator({ status }: { status: ToolStatus }) {
  switch (status) {
    case "running":
    case "pending":
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
    case "completed":
      return <Check className="h-3.5 w-3.5 text-emerald-500" />
    case "error":
      return <X className="h-3.5 w-3.5 text-destructive" />
  }
}

export function ToolCard({
  info,
  status,
  children,
  defaultOpen,
}: {
  info: ToolInfo
  status: ToolStatus
  children?: React.ReactNode
  defaultOpen?: boolean
}) {
  const isActive = status === "running" || status === "pending"
  const isCompleted = status === "completed"
  const isError = status === "error"
  const [open, setOpen] = useState(defaultOpen ?? false)

  // Auto-expand on completion
  useEffect(() => {
    if (isCompleted || isError) setOpen(true)
  }, [isCompleted, isError])

  const IconComponent = ICON_MAP[info.icon] || Wrench

  const borderColor = isError
    ? "border-destructive/30"
    : isActive
      ? "border-amber-500/30"
      : isCompleted
        ? "border-emerald-500/20"
        : "border-border/60"

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn("rounded-xl border bg-card/50 transition-colors", borderColor)}>
        <CollapsibleTrigger asChild>
          <button
            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left text-sm hover:bg-muted/30 transition-colors rounded-t-xl"
          >
            <StatusIndicator status={status} />
            <IconComponent className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <TextShimmer active={isActive} className="font-medium text-foreground text-[13px] truncate">
                {info.title}
              </TextShimmer>
              {info.subtitle && (
                <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                  {info.subtitle}
                </span>
              )}
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
          <div className="px-3 pb-3 space-y-2 border-t border-border/30">
            {children}

            {info.inputLines.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                  Input
                </summary>
                <div className="mt-1 rounded-md border border-border/50 bg-background/60 p-2 space-y-1">
                  {info.inputLines.map((line, idx) => (
                    <div key={idx} className="font-mono text-[11px] break-all text-muted-foreground">
                      {line}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {info.output && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                  Output
                </summary>
                <div className="mt-1 rounded-md border border-border/50 bg-background/60 p-2 max-h-[300px] overflow-y-auto">
                  <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-mono break-words">
                    {info.output}
                  </pre>
                </div>
              </details>
            )}

            {info.error && (
              <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-destructive text-[11px] break-words">
                {info.error}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
