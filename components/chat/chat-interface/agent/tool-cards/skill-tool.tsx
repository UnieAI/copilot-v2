"use client"

import { BasicTool } from "./basic-tool"
import { getToolInfo, type ToolCardProps } from "./index"

export function SkillTool({ part, defaultOpen }: ToolCardProps) {
  const info = getToolInfo("skill", part.state.input)
  const output =
    part.state.status === "completed"
      ? part.state.output
      : part.state.status === "error"
        ? part.state.error
        : undefined
  const summary = output?.trim()
    ? output.trim().split("\n").find(Boolean)?.slice(0, 160)
    : "執行 skill"

  return (
    <BasicTool
      icon={info.icon}
      title={info.title}
      summary={summary}
      subtitle={info.subtitle}
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
