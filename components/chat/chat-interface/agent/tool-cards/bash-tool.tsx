"use client"

import { BasicTool } from "./basic-tool"
import { getToolInfo, type ToolCardProps } from "./index"

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "")
}

export function BashTool({ part, defaultOpen }: ToolCardProps) {
  const info = getToolInfo("bash", part.state.input)
  const command = (part.state.input.command as string) || ""
  const output =
    part.state.status === "completed"
      ? stripAnsi(part.state.output || "")
      : part.state.status === "error"
        ? part.state.error
        : undefined
  const summary =
    output?.trim()
      ? output.trim().split("\n").find(Boolean)?.slice(0, 160)
      : command

  return (
    <BasicTool
      icon={info.icon}
      title={info.title}
      subtitle={command.length > 60 ? command.slice(0, 60) + "..." : command}
      summary={summary}
      status={part.state.status}
      defaultOpen={defaultOpen}
    >
      {command && (
        <div className="mb-2">
          <pre className="text-xs bg-muted/60 rounded-md px-3 py-2 overflow-x-auto font-mono text-foreground/80">
            <code>$ {command}</code>
          </pre>
        </div>
      )}
      {output && (
        <pre className="text-xs bg-zinc-950 dark:bg-zinc-900 text-zinc-300 rounded-md px-3 py-2 overflow-x-auto max-h-[300px] overflow-y-auto font-mono">
          <code>{output}</code>
        </pre>
      )}
    </BasicTool>
  )
}
