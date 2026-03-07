"use client"

import { BasicTool } from "./basic-tool"
import { getToolInfo, type ToolCardProps } from "./index"

export function WriteTool({ part, defaultOpen }: ToolCardProps) {
  const info = getToolInfo("write", part.state.input)
  const output =
    part.state.status === "completed"
      ? part.state.output
      : part.state.status === "error"
        ? part.state.error
        : undefined
  const summary = output?.trim()
    ? output.trim().split("\n").find(Boolean)?.slice(0, 160)
    : "寫入檔案中"

  return (
    <BasicTool
      icon={info.icon}
      title={info.title}
      subtitle={info.subtitle}
      summary={summary}
      status={part.state.status}
      defaultOpen={defaultOpen}
    >
      {output && (
        <pre className="text-xs bg-muted/40 rounded-md px-3 py-2 overflow-x-auto max-h-[300px] overflow-y-auto font-mono text-foreground/70">
          <code>{output}</code>
        </pre>
      )}
    </BasicTool>
  )
}
