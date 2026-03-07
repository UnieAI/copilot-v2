"use client"

import { BasicTool } from "./basic-tool"
import { getToolInfo, type ToolCardProps } from "./index"

export function GlobTool({ part, defaultOpen }: ToolCardProps) {
  const info = getToolInfo("glob", part.state.input)
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
          ? `${matches.length} 個結果`
          : part.state.status === "running"
            ? "搜尋檔案中"
            : undefined
      }
      status={part.state.status}
      defaultOpen={defaultOpen}
    >
      {output && (
        <div className="text-xs space-y-0.5 max-h-[200px] overflow-y-auto">
          {output.split("\n").filter(Boolean).map((file, i) => (
            <div key={i} className="text-muted-foreground font-mono truncate">
              {file}
            </div>
          ))}
        </div>
      )}
    </BasicTool>
  )
}
