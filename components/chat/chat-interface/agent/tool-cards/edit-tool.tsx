"use client"

import { BasicTool } from "./basic-tool"
import { getToolInfo, type ToolCardProps } from "./index"

export function EditTool({ part, defaultOpen }: ToolCardProps) {
  const info = getToolInfo("edit", part.state.input)
  const output =
    part.state.status === "completed"
      ? part.state.output
      : part.state.status === "error"
        ? part.state.error
        : undefined
  const summary = output?.trim()
    ? output.trim().split("\n").find(Boolean)?.slice(0, 160)
    : "準備修改檔案"

  return (
    <BasicTool
      icon={info.icon}
      title={info.title}
      subtitle={info.subtitle}
      summary={summary}
      status={part.state.status}
      defaultOpen={defaultOpen}
    >
      {output && <DiffDisplay content={output} />}
    </BasicTool>
  )
}

function DiffDisplay({ content }: { content: string }) {
  const lines = content.split("\n")
  return (
    <pre className="text-xs rounded-md px-3 py-2 overflow-x-auto max-h-[400px] overflow-y-auto font-mono bg-muted/40">
      {lines.map((line, i) => {
        let className = "text-foreground/70"
        if (line.startsWith("+") && !line.startsWith("+++")) {
          className = "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          className = "text-red-600 dark:text-red-400 bg-red-500/10"
        } else if (line.startsWith("@@")) {
          className = "text-blue-500"
        }
        return (
          <div key={i} className={className}>
            {line}
          </div>
        )
      })}
    </pre>
  )
}
