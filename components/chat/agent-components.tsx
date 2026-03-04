import { useState } from "react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
    Loader2, Sparkles, Settings2, ArrowUpRight,
    CircleCheckBig, CircleDot, Circle, Check
} from "lucide-react"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import type { AgentToolCall } from "./types"
import { resolveTodoItems } from "./utils"
import { toast } from "sonner"
import { useInstanceStore } from "@/hooks/use-instance-store"
import { appendInstanceParams } from "@/lib/opencode/client-utils"
import type { PermissionRequest as PermReq, QuestionRequest as QReq } from "@/lib/agent/types"

export function AgentToolFlowButton({
    callCount,
    isRunning,
    activeLabel,
    onOpen,
}: {
    callCount: number
    isRunning: boolean
    activeLabel?: string
    onOpen: () => void
}) {
    const text = isRunning
        ? (activeLabel ? `執行中：${activeLabel}` : "工具流程執行中")
        : "查看工具流程"
    return (
        <button
            type="button"
            onClick={onOpen}
            className="group inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs transition-colors hover:bg-background"
        >
            {isRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
                <Sparkles className="h-3.5 w-3.5 text-primary/90" />
            )}
            <span
                className={`font-medium bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-500 bg-clip-text text-transparent ${isRunning ? "animate-pulse" : ""}`}
            >
                {text}
            </span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {callCount}
            </span>
        </button>
    )
}

export function formatInlineAgentToolCall(call: AgentToolCall): { icon: string; label: string; details?: string } {
    const input = call.input || {}
    const toolName = (call.tool || "").toLowerCase()

    if (toolName === "edit") {
        const filePath = String(input.filePath || input.file || "")
        const oldStr = String(input.oldString || "")
        const newStr = String(input.newString || "")
        const additions = newStr ? newStr.split("\n").length : 0
        const deletions = oldStr ? oldStr.split("\n").length : 0
        return {
            icon: "✎",
            label: `edit ${filePath}`.trim(),
            details: additions || deletions ? `(+${additions}-${deletions})` : undefined,
        }
    }

    if (toolName === "read") {
        const filePath = String(input.filePath || input.file || "")
        return { icon: "◉", label: `read ${filePath}`.trim() }
    }

    if (toolName === "write") {
        const filePath = String(input.filePath || input.file || "")
        const content = String(input.content || "")
        const lines = content ? content.split("\n").length : 0
        return {
            icon: "✦",
            label: `write ${filePath}`.trim(),
            details: lines ? `(${lines} lines)` : undefined,
        }
    }

    if (toolName === "bash") {
        const command = String(input.command || input.cmd || "")
        const shortCmd = command.split("\n")[0]?.slice(0, 56) || ""
        return {
            icon: "$",
            label: `bash ${shortCmd}${command.length > 56 ? "..." : ""}`.trim(),
            details: typeof input.description === "string" && input.description ? `# ${input.description}` : undefined,
        }
    }

    if (toolName === "glob") {
        const pattern = String(input.pattern || "")
        const path = String(input.path || "")
        return {
            icon: "⌕",
            label: `glob ${pattern}`.trim(),
            details: path ? `in ${path}` : undefined,
        }
    }

    if (toolName === "grep") {
        const pattern = String(input.pattern || "")
        const path = String(input.path || "")
        return {
            icon: "▣",
            label: `grep "${pattern}"`,
            details: path ? `in ${path}` : undefined,
        }
    }

    if (toolName === "task") {
        const sub = String(input.subagent_type || "subagent")
        return {
            icon: "↗",
            label: `task @${sub}`,
            details: call.subtitle || undefined,
        }
    }

    const firstArg = Object.entries(input)[0]
    return {
        icon: "▣",
        label: toolName || "unknown",
        details: firstArg ? `${firstArg[0]}: ${String(firstArg[1]).slice(0, 30)}...` : undefined,
    }
}

export function AgentToolInlineItem({
    call,
    localePrefix,
}: {
    call: AgentToolCall
    localePrefix: string
}) {
    const { icon, label, details } = formatInlineAgentToolCall(call)
    const todoItems = resolveTodoItems(call)
    const isCompleted = call.status === "completed"
    const isError = call.status === "error"
    const isPending = call.status === "pending" || call.status === "running"
    const colorClass = isError
        ? "text-destructive"
        : isCompleted
            ? "text-muted-foreground"
            : isPending
                ? "text-amber-700 dark:text-amber-300"
                : "text-foreground"

    return (
        <div className="space-y-1">
            <div className={`font-mono text-xs flex items-center gap-1.5 py-0.5 min-w-0 ${colorClass}`}>
                <span className="opacity-70 shrink-0">{icon}</span>
                {call.childSessionId ? (
                    <Link
                        href={`${localePrefix}/chat?mode=agent&id=${encodeURIComponent(call.childSessionId)}`}
                        className="truncate underline underline-offset-2 decoration-dotted hover:text-primary transition-colors"
                        title={`切換到子任務 Session: ${call.childSessionId}`}
                    >
                        {label}
                    </Link>
                ) : (
                    <span className="truncate">{label}</span>
                )}
                {details && <span className="opacity-70 shrink-0">{details}</span>}
                {isPending && <span className="animate-pulse shrink-0">...</span>}
            </div>

            {todoItems.length > 0 && (
                <div className="ml-5 space-y-1">
                    {todoItems.map((todo, idx) => {
                        const status = String(todo.status || "pending").toLowerCase()
                        return (
                            <div key={`${call.id}-inline-todo-${idx}`} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                                <span className="mt-[2px] shrink-0">
                                    {status === "completed" ? "✓" : status === "in_progress" ? "◉" : "○"}
                                </span>
                                <span className={status === "completed" ? "line-through" : ""}>{todo.content}</span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ─── Status Badge ───────────────────────────────────────────────────────
export function StatusBadge({ text }: { text: string }) {
    if (!text) return null
    return (
        <div className="flex items-center justify-center gap-2 py-2">
            <div className="flex items-center gap-2 bg-muted/80 backdrop-blur border border-border rounded-full px-4 py-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{text}</span>
            </div>
        </div>
    )
}

export function AgentToolCallCard({
    call,
    localePrefix,
}: {
    call: AgentToolCall
    localePrefix: string
}) {
    const todoItems = resolveTodoItems(call)
    const statusClass =
        call.status === "completed"
            ? "text-emerald-700 bg-emerald-500/10"
            : call.status === "error"
                ? "text-destructive bg-destructive/10"
                : call.status === "running" || call.status === "pending"
                    ? "text-amber-700 bg-amber-500/10"
                    : "text-muted-foreground bg-muted"
    const running = call.status === "running" || call.status === "pending"
    return (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    {running ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    ) : (
                        <Settings2 className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className={`font-medium text-foreground truncate ${running ? "animate-pulse" : ""}`}>
                        {call.title}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] uppercase ${statusClass}`}>
                        {call.status}
                    </span>
                </div>
                {call.childSessionId && (
                    <Link
                        href={`${localePrefix}/chat?mode=agent&id=${encodeURIComponent(call.childSessionId)}`}
                        className="inline-flex items-center gap-1 text-[10px] rounded-md border border-border px-1.5 py-1 hover:bg-background transition-colors shrink-0"
                        title={`切換到子任務 Session: ${call.childSessionId}`}
                    >
                        <span>subagent</span>
                        <ArrowUpRight className="h-3 w-3" />
                    </Link>
                )}
            </div>

            {call.subtitle && (
                call.childSessionId ? (
                    <Link
                        href={`${localePrefix}/chat?mode=agent&id=${encodeURIComponent(call.childSessionId)}`}
                        className="mt-1 block text-[11px] text-primary/90 hover:text-primary break-words underline underline-offset-2"
                    >
                        {call.subtitle}
                    </Link>
                ) : (
                    <div className="mt-1 text-[11px] text-muted-foreground break-words">
                        {call.subtitle}
                    </div>
                )
            )}

            {todoItems.length > 0 && (
                <div className="mt-2 rounded-md border border-border/50 bg-background/60 p-2 space-y-1.5">
                    {todoItems.map((todo, idx) => {
                        const status = String(todo.status || "pending").toLowerCase()
                        const priority = String(todo.priority || "medium").toLowerCase()
                        const priorityClass =
                            priority === "high"
                                ? "text-rose-700 bg-rose-500/10"
                                : priority === "low"
                                    ? "text-emerald-700 bg-emerald-500/10"
                                    : "text-amber-700 bg-amber-500/10"
                        return (
                            <div key={`${call.id}-todo-${idx}`} className="flex items-start gap-2">
                                <div className="mt-0.5 text-muted-foreground">
                                    {status === "completed" ? (
                                        <CircleCheckBig className="h-3.5 w-3.5 text-emerald-600" />
                                    ) : status === "in_progress" ? (
                                        <CircleDot className="h-3.5 w-3.5 text-sky-600 animate-pulse" />
                                    ) : (
                                        <Circle className="h-3.5 w-3.5" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className={`text-[11px] break-words ${status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                        {todo.content}
                                    </div>
                                    <div className="mt-1 flex items-center gap-1.5">
                                        <span className="px-1.5 py-0.5 rounded-full text-[9px] uppercase bg-muted text-muted-foreground">
                                            {status}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] uppercase ${priorityClass}`}>
                                            {priority}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {call.inputLines.length > 0 && (
                <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                        input
                    </summary>
                    <div className="mt-1 rounded-md border border-border/50 bg-background/60 p-2 space-y-1">
                        {call.inputLines.map((line, idx) => (
                            <div key={`${call.id}-line-${idx}`} className="font-mono text-[11px] break-all">
                                {line}
                            </div>
                        ))}
                    </div>
                </details>
            )}

            {call.output && (
                <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                        output
                    </summary>
                    <div className="mt-1 rounded-md border border-border/50 bg-background/60 p-2 max-h-[280px] overflow-y-auto prose prose-xs dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{call.output}</ReactMarkdown>
                    </div>
                </details>
            )}

            {call.error && (
                <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-destructive break-words">
                    {call.error}
                </div>
            )}
        </div>
    )
}

export const ModelItem = ({
    model,
    isSelected,
    onSelect
}: {
    model: any;
    isSelected: boolean;
    onSelect: (value: string) => void
}) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <DropdownMenuItem
            onSelect={() => onSelect(model.value)}
            asChild // 關鍵：讓 DropdownMenuItem 渲染成你自定義的按鈕樣式
        >
            <button
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-all text-left group outline-none ${isSelected
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted/60 text-foreground/90 hover:text-foreground"
                    }`}
            >
                <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="text-sm truncate leading-tight">{model.label}</span>
                    <span className={`text-[10px] font-medium uppercase tracking-wider leading-tight ${isSelected
                        ? "text-primary/80"
                        : "text-muted-foreground group-hover:text-muted-foreground/80"
                        }`}>
                        {model.providerName}
                    </span>
                </div>
                {isSelected ? (
                    <Check className="h-4 w-4 opacity-100 shrink-0" />
                ) : (
                    // <ChevronsUpDown className={`h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${isHovered ? "opacity-100" : ""
                    //     }`} />
                    <></>
                )}
            </button>
        </DropdownMenuItem>
    );
};
// ─── Agent Permission Card ───────────────────────────────────────────
export function AgentPermissionCard({ perm, sessionId }: { perm: PermReq; sessionId: string }) {
    const [loading, setLoading] = useState(false)
    const { instance: permInstance } = useInstanceStore()

    const reply = async (action: "once" | "always" | "reject") => {
        setLoading(true)
        try {
            await fetch(appendInstanceParams(`/api/agent/permission/${perm.id}/reply`, permInstance), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reply: action, sessionID: sessionId }),
            })
        } catch (e: any) {
            toast.error(e?.message || "Failed to respond")
        } finally {
            setLoading(false)
        }
    }

    // Format permission display
    const permLabel = perm.permission || "action"
    const patterns = perm.patterns || []

    return (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                <span className="text-sm font-semibold text-foreground">Permission Required</span>
            </div>
            <div className="space-y-1">
                <p className="text-sm text-foreground/90">
                    Allow <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs font-mono font-bold">{permLabel}</code>?
                </p>
                {patterns.length > 0 && (
                    <div className="text-xs text-muted-foreground font-mono space-y-0.5 pl-2 border-l-2 border-border/50 mt-2">
                        {patterns.map((p, i) => <div key={i}>{p}</div>)}
                    </div>
                )}
            </div>
            <div className="flex gap-2 pt-1">
                <button onClick={() => reply("once")} disabled={loading}
                    className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    Allow Once
                </button>
                {perm.always && perm.always.length > 0 && (
                    <button onClick={() => reply("always")} disabled={loading}
                        className="px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-md border border-primary/30 disabled:opacity-50 transition-colors">
                        Always Allow
                    </button>
                )}
                <button onClick={() => reply("reject")} disabled={loading}
                    className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md border border-border disabled:opacity-50 transition-colors">
                    Deny
                </button>
            </div>
        </div>
    )
}

// ─── Agent Question Card ─────────────────────────────────────────────
export function AgentQuestionCard({ question, sessionId }: { question: QReq; sessionId: string }) {
    const [loading, setLoading] = useState(false)
    const { instance: qInstance } = useInstanceStore()
    // Track selected answers per question (index → selected labels)
    const [selections, setSelections] = useState<string[][]>(() =>
        question.questions.map(() => [])
    )
    const [customInputs, setCustomInputs] = useState<string[]>(() =>
        question.questions.map(() => "")
    )

    const toggleOption = (qIdx: number, label: string, multiple?: boolean) => {
        setSelections(prev => {
            const next = [...prev]
            const current = next[qIdx] || []
            if (multiple) {
                next[qIdx] = current.includes(label)
                    ? current.filter(l => l !== label)
                    : [...current, label]
            } else {
                next[qIdx] = current.includes(label) ? [] : [label]
            }
            return next
        })
    }

    const submit = async () => {
        // Build answers: for each question, combine selected options + custom text
        const answers: string[][] = question.questions.map((q, i) => {
            const selected = selections[i] || []
            const custom = customInputs[i]?.trim()
            const result = [...selected]
            if (custom) result.push(custom)
            return result
        })
        // Validate: at least one answer per question
        const hasEmpty = answers.some(a => a.length === 0)
        if (hasEmpty) {
            toast.error("Please answer all questions")
            return
        }
        setLoading(true)
        try {
            await fetch(appendInstanceParams(`/api/agent/question/${question.id}/reply`, qInstance), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers }),
            })
        } catch (e: any) {
            toast.error(e?.message || "Failed to respond")
        } finally {
            setLoading(false)
        }
    }

    const reject = async () => {
        setLoading(true)
        try {
            await fetch(appendInstanceParams(`/api/agent/question/${question.id}/reject`, qInstance), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            })
        } catch (e: any) {
            toast.error(e?.message || "Failed to respond")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-semibold text-foreground">Agent needs your input</span>
            </div>

            {question.questions.map((q, qIdx) => (
                <div key={qIdx} className="space-y-2">
                    {q.header && (
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 bg-muted/50 px-2 py-0.5 rounded">
                            {q.header}
                        </span>
                    )}
                    <p className="text-sm text-foreground/90">{q.question}</p>
                    {q.options && q.options.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {q.options.map((opt) => {
                                const isSelected = (selections[qIdx] || []).includes(opt.label)
                                return (
                                    <button
                                        key={opt.label}
                                        onClick={() => toggleOption(qIdx, opt.label, true)}
                                        disabled={loading}
                                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-all disabled:opacity-50 text-left ${isSelected
                                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                            : 'bg-muted/50 hover:bg-muted text-foreground border-border hover:border-foreground/20'
                                            }`}
                                        title={opt.description}
                                    >
                                        <div className={`flex shrink-0 items-center justify-center h-4 w-4 rounded-sm border ${isSelected ? 'bg-primary-foreground text-primary border-primary-foreground' : 'border-foreground/30 bg-background/50'}`}>
                                            {isSelected && <Check className="h-3 w-3" />}
                                        </div>
                                        <span className="text-left">{opt.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                    {(q.custom !== false) && (
                        <input
                            value={customInputs[qIdx] || ""}
                            onChange={(e) => setCustomInputs(prev => {
                                const next = [...prev]
                                next[qIdx] = e.target.value
                                return next
                            })}
                            placeholder="Or type your own answer..."
                            disabled={loading}
                            className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault()
                                    submit()
                                }
                            }}
                        />
                    )}
                </div>
            ))}

            <div className="flex gap-2 pt-1 border-t border-border/30">
                <button onClick={submit} disabled={loading}
                    className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    Submit
                </button>
                <button onClick={reject} disabled={loading}
                    className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md border border-border disabled:opacity-50 transition-colors">
                    Skip
                </button>
            </div>
        </div>
    )
}
