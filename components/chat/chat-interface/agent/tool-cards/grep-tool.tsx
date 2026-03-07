"use client"

import { BasicTool } from "./basic-tool"
import { getToolInfo, type ToolCardProps } from "./index"

export function GrepTool({ part, defaultOpen }: ToolCardProps) {
  const info = getToolInfo("grep", part.state.input)
  const output =
    part.state.status === "completed" ? part.state.output : undefined
  const matches = output?.split("\n").filter(Boolean) || []

  return (
    <BasicTool
      icon={info.icon}
      title={info.title}
      subtitle={info.subtitle}
      summary={
        matches.length > 0
          ? matches[0].slice(0, 160)
          : part.state.status === "running"
            ? "搜尋內容中"
            : undefined
      }
      status={part.state.status}
      defaultOpen={defaultOpen}
    >
      {output && (
        <pre className="text-xs bg-muted/40 rounded-md px-3 py-2 overflow-x-auto max-h-[200px] overflow-y-auto font-mono text-foreground/70">
          <code>{output}</code>
        </pre>
      )}
    </BasicTool>
  )
}
