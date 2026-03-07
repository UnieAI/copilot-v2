"use client"

import { BasicTool } from "./basic-tool"
import { getToolInfo, type ToolCardProps } from "./index"

export function GenericTool({ part, defaultOpen }: ToolCardProps) {
  const info = getToolInfo(part.tool, part.state.input)
  const hasInput =
    part.state.input && Object.keys(part.state.input).length > 0
  const output =
    part.state.status === "completed"
      ? part.state.output
      : part.state.status === "error"
        ? part.state.error
        : undefined
  const summary = output?.trim()
    ? output.trim().split("\n").find(Boolean)?.slice(0, 160)
    : hasInput
      ? JSON.stringify(part.state.input).slice(0, 160)
      : undefined

  return (
    <BasicTool
      icon={info.icon}
      title={info.title}
      subtitle={info.subtitle}
      summary={summary}
      status={part.state.status}
      defaultOpen={defaultOpen}
    >
      {hasInput && (
        <div className="mb-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Input
          </div>
          <pre className="text-xs bg-muted/40 rounded-md px-3 py-2 overflow-x-auto max-h-[150px] overflow-y-auto font-mono text-foreground/70">
            <code>{JSON.stringify(part.state.input, null, 2)}</code>
          </pre>
        </div>
      )}
      {output && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Output
          </div>
          <pre className="text-xs bg-muted/40 rounded-md px-3 py-2 overflow-x-auto max-h-[200px] overflow-y-auto font-mono text-foreground/70">
            <code>{output}</code>
          </pre>
        </div>
      )}
    </BasicTool>
  )
}
