"use client"

import { useMemo, useState } from "react"
import {
  CheckCircle2,
  Circle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { Todo } from "./types"

const STATUS_ICONS = {
  completed: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  cancelled: <XCircle className="h-3.5 w-3.5 text-red-400" />,
  in_progress: <Clock className="h-3.5 w-3.5 text-blue-500 animate-pulse" />,
  pending: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
} as const

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-500 bg-red-500/10",
  medium: "text-amber-500 bg-amber-500/10",
  low: "text-blue-500 bg-blue-500/10",
}

export function TodoPanel({ todos }: { todos: Todo[] }) {
  const [collapsed, setCollapsed] = useState(false)
  if (todos.length === 0) return null

  const completedCount = todos.filter((todo) => todo.status === "completed").length
  const currentTodo = useMemo(() => {
    return (
      todos.find((todo) => todo.status === "in_progress") ||
      todos.find((todo) => todo.status === "pending") ||
      todos.find((todo) => todo.status !== "completed" && todo.status !== "cancelled") ||
      todos[todos.length - 1] ||
      null
    )
  }, [todos])

  return (
    <div className="w-full rounded-xl border border-border/60 bg-background/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Tasks ({completedCount}/{todos.length})
          </div>
          {collapsed && currentTodo && (
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="shrink-0">
                {STATUS_ICONS[currentTodo.status as keyof typeof STATUS_ICONS] || STATUS_ICONS.pending}
              </span>
              <span className="truncate text-foreground/90">{currentTodo.content}</span>
            </div>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {!collapsed && (
        <div className="space-y-1.5 border-t border-border/60 px-3 py-2">
          {todos.map((todo, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs"
            >
              <span className="mt-0.5 shrink-0">
                {STATUS_ICONS[todo.status as keyof typeof STATUS_ICONS] || STATUS_ICONS.pending}
              </span>
              <span
                className={`flex-1 break-words ${todo.status === "completed" || todo.status === "cancelled"
                  ? "line-through text-muted-foreground"
                  : "text-foreground/90"
                  }`}
              >
                {todo.content}
              </span>
              {todo.priority && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${PRIORITY_COLORS[todo.priority] || ""
                    }`}
                >
                  {todo.priority}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
