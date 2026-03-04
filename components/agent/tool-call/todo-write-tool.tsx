"use client"

import { CheckCircle2, Circle, Dot } from "lucide-react"
import { ToolCard } from "./tool-card"
import type { AgentToolPart } from "@/lib/agent/types"
import { getToolInfo } from "@/lib/agent/tool-info"
import { normalizeToolStatus } from "@/lib/agent/tool-status"

type TodoItem = {
  id?: string
  content: string
  status: "pending" | "in_progress" | "completed"
  priority?: "low" | "medium" | "high"
}

function normalizeTodoItem(item: any): TodoItem | null {
  if (!item || typeof item !== "object") return null
  const content = String(item.content || item.text || "").trim()
  if (!content) return null
  const rawStatus = String(item.status || "pending").toLowerCase()
  const status = rawStatus === "completed"
    ? "completed"
    : rawStatus === "in_progress" || rawStatus === "in-progress"
      ? "in_progress"
      : "pending"
  const rawPriority = String(item.priority || "").toLowerCase()
  const priority = rawPriority === "high" || rawPriority === "medium" || rawPriority === "low"
    ? rawPriority
    : undefined
  return {
    id: typeof item.id === "string" ? item.id : undefined,
    content,
    status,
    priority,
  }
}

function parseTodoJson(text: string): TodoItem[] {
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.todos)
        ? parsed.todos
        : []
    return list.map(normalizeTodoItem).filter(Boolean) as TodoItem[]
  } catch {
    return []
  }
}

function resolveTodoItems(part: AgentToolPart): TodoItem[] {
  const inputTodos = (part.state?.input as any)?.todos
  if (Array.isArray(inputTodos)) {
    const fromInput = inputTodos.map(normalizeTodoItem).filter(Boolean) as TodoItem[]
    if (fromInput.length > 0) return fromInput
  }
  const output = typeof part.state?.output === "string" ? part.state.output : ""
  const fromOutput = parseTodoJson(output)
  if (fromOutput.length > 0) return fromOutput
  const raw = typeof part.state?.raw === "string" ? part.state.raw : ""
  return parseTodoJson(raw)
}

function priorityClass(priority?: TodoItem["priority"]) {
  if (priority === "high") return "text-red-600 bg-red-500/10 border-red-500/20"
  if (priority === "medium") return "text-amber-600 bg-amber-500/10 border-amber-500/20"
  if (priority === "low") return "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
  return "text-muted-foreground bg-muted border-border/50"
}

export function TodoWriteTool({ part }: { part: AgentToolPart }) {
  const info = getToolInfo(part)
  const status = normalizeToolStatus(part.state?.status)
  const todos = resolveTodoItems(part)
  const completed = todos.filter((todo) => todo.status === "completed").length
  const total = todos.length

  return (
    <ToolCard info={info} status={status}>
      <div className="mt-2 rounded-md border border-border/50 bg-background/70 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-foreground/90">
            Todo Progress
          </span>
          <span className="text-[11px] text-muted-foreground">
            {completed}/{total || 0}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
          />
        </div>

        {todos.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            {todos.map((todo, index) => {
              const isDone = todo.status === "completed"
              const isActive = todo.status === "in_progress"
              return (
                <div key={todo.id || `${todo.content}-${index}`} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : isActive ? (
                      <Dot className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground/70" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12px] leading-relaxed ${isDone ? "line-through text-muted-foreground" : "text-foreground/90"}`}>
                      {todo.content}
                    </p>
                  </div>
                  {todo.priority && (
                    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] uppercase ${priorityClass(todo.priority)}`}>
                      {todo.priority}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground">
            No todo items in payload yet.
          </p>
        )}
      </div>
    </ToolCard>
  )
}
