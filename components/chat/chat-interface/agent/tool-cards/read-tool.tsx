"use client"

import { BasicTool } from "./basic-tool"
import { getToolInfo, type ToolCardProps } from "./index"

export function ReadTool({ part, defaultOpen }: ToolCardProps) {
  const info = getToolInfo("read", part.state.input)
  const output = part.state.status === "completed" ? part.state.output : undefined
  return (
    <BasicTool
      icon={info.icon}
      title={info.title}
      subtitle={info.subtitle}
      summary={output?.trim() ? output.trim().split("\n").find(Boolean)?.slice(0, 160) : "讀取檔案中"}
      status={part.state.status}
      defaultOpen={defaultOpen}
    >
      {part.state.status === "completed" && output && (
        <pre className="text-xs bg-muted/40 rounded-md px-3 py-2 overflow-x-auto max-h-[200px] overflow-y-auto font-mono text-foreground/70">
          <code>{output}</code>
        </pre>
      )}
    </BasicTool>
  )
}
