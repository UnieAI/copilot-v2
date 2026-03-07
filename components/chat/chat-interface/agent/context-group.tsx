"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { TextShimmer } from "./text-shimmer"
import type { ToolPart } from "./types"
import { getToolInfo } from "./tool-cards"

function getFilename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/")
  return parts[parts.length - 1] || path
}

function contextToolDetail(part: ToolPart): string | undefined {
  const input = part.state.input ?? {}
  if (part.tool === "read" && input.filePath)
    return getFilename(input.filePath as string)
  if (part.tool === "glob" && input.pattern) return input.pattern as string
  if (part.tool === "grep" && input.pattern) return input.pattern as string
  if (part.tool === "list" && input.path)
    return getFilename(input.path as string)
  return undefined
}

function contextToolSummary(parts: ToolPart[]): string[] {
  const read = parts.filter((p) => p.tool === "read").length
  const search = parts.filter(
    (p) => p.tool === "glob" || p.tool === "grep",
  ).length
  const list = parts.filter((p) => p.tool === "list").length

  const items: string[] = []
  if (read) items.push(`Read ${read} file${read !== 1 ? "s" : ""}`)
  if (search)
    items.push(`${search} search${search !== 1 ? "es" : ""}`)
  if (list) items.push(`${list} list${list !== 1 ? "s" : ""}`)
  return items
}

export function ContextGroup({
  parts,
  busy = false,
}: {
  parts: ToolPart[]
  busy?: boolean
}) {
  const [open, setOpen] = useState(false)
  const pending =
    busy ||
    parts.some(
      (p) =>
        p.state.status === "pending" || p.state.status === "running",
    )
  const summary = contextToolSummary(parts)
  const details = summary.join(", ")

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-lg hover:bg-muted/50 transition-colors text-left">
          <ChevronRight
            className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 shrink-0 ${
              open ? "rotate-90" : ""
            }`}
          />
          <span className="text-muted-foreground">
            {pending ? (
              <TextShimmer text="Gathering context..." />
            ) : (
              <>
                <span className="font-medium text-foreground/80">
                  Gathered context
                </span>
                {details && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {details}
                  </span>
                )}
              </>
            )}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-6 space-y-0.5 pb-1">
          {parts.map((part) => {
            const info = getToolInfo(part.tool, part.state.input)
            const detail = contextToolDetail(part)
            const running =
              part.state.status === "pending" ||
              part.state.status === "running"
            return (
              <div
                key={part.id}
                className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"
              >
                <span className="font-medium">
                  {running ? (
                    <TextShimmer text={info.title} />
                  ) : (
                    info.title
                  )}
                </span>
                {!running && detail && (
                  <span className="truncate">{detail}</span>
                )}
              </div>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
