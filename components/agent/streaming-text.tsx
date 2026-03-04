"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { Brain, ChevronUp, ChevronDown, Loader2 } from "lucide-react"
import { MarkdownCode } from "@/components/chat/markdown-code"
import { TextGenerateEffect } from "@/components/ui/text-generate-effect"

// Throttle value updates to limit markdown re-parsing during rapid deltas
function useThrottledValue(value: string, ms: number): string {
  const [throttled, setThrottled] = useState(value)
  const lastUpdate = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const now = Date.now()
    const elapsed = now - lastUpdate.current

    if (elapsed >= ms) {
      setThrottled(value)
      lastUpdate.current = now
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    } else {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setThrottled(value)
        lastUpdate.current = Date.now()
        timerRef.current = null
      }, ms - elapsed)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value, ms])

  useEffect(() => {
    return () => setThrottled(value)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return throttled
}

const MarkdownComponents: any = {
  h1: ({ children }: any) => <h1 className="text-xl font-bold mt-6 mb-2 text-foreground">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-lg font-semibold mt-5 mb-2 text-foreground/90">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-base font-semibold mt-4 mb-1 text-foreground/80">{children}</h3>,
  p: ({ children }: any) => <p className="leading-7 mb-4 last:mb-0 text-foreground/90">{children}</p>,
  ul: ({ children }: any) => <ul className="list-disc pl-6 mb-4 space-y-2 text-foreground/90">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-foreground/90">{children}</ol>,
  li: ({ children }: any) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-primary/30 pl-4 py-1 my-4 italic bg-primary/5 rounded-r-lg text-muted-foreground">
      {children}
    </blockquote>
  ),
  table: ({ children }: any) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-border/40 shadow-sm">
      <table className="w-full border-collapse text-sm text-left">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-muted/50 border-b border-border/40">{children}</thead>,
  th: ({ children }: any) => <th className="px-4 py-3 font-semibold text-foreground/80">{children}</th>,
  td: ({ children }: any) => <td className="px-4 py-3 border-b border-border/20 last:border-0">{children}</td>,
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="text-primary font-medium underline underline-offset-4 hover:text-primary/80 transition-colors">
      {children}
    </a>
  ),
  code: ({ node, inline, className, children, ...props }: any) => {
    const content = String(children).replace(/\n$/, "")
    const hasNewline = content.includes("\n")
    const language = className?.replace(/language-/, "")

    if (!hasNewline && !language) {
      return (
        <code className="mx-1 rounded-md px-1.5 py-0.5 bg-muted/80 dark:bg-white/10 text-primary dark:text-primary-foreground font-mono text-[0.85em] font-bold border border-border/40 break-all" {...props}>
          {content}
        </code>
      )
    }

    return <MarkdownCode className={className} language={language} codeText={content} {...props} />
  },
}

// ─── Think Block (collapsible reasoning) ─────────────────────────────
function ThinkBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null)
  const expanded = userExpanded !== null ? userExpanded : !!isStreaming

  return (
    <div className="my-3 flex flex-col gap-2">
      <button
        onClick={() => setUserExpanded(!expanded)}
        className="w-fit flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
      >
        {isStreaming ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/70" />
        ) : (
          <Brain className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
        )}
        <span>思考過程</span>
        {expanded ? <ChevronUp className="h-3 w-3 opacity-50" /> : <ChevronDown className="h-3 w-3 opacity-50" />}
      </button>
      {expanded && (
        <div className="pl-4 ml-[7px] border-l-2 border-border/60 text-[13px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed animate-in fade-in slide-in-from-top-1 duration-300">
          {content.trim()}
        </div>
      )}
    </div>
  )
}

// Parse <think>...</think> blocks from text content
type ParsedPart = { type: "text" | "think"; content: string; unfinished?: boolean }

function stripOrphanThinkClosings(input: string): string {
  const tagRegex = /<\/?think>/gi
  let depth = 0
  let lastIndex = 0
  let out = ""
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(input)) !== null) {
    const tag = match[0].toLowerCase()
    const start = match.index
    out += input.slice(lastIndex, start)

    if (tag === "<think>") {
      depth += 1
      out += match[0]
    } else if (depth > 0) {
      depth -= 1
      out += match[0]
    }

    lastIndex = start + match[0].length
  }

  out += input.slice(lastIndex)
  return out
}

function parseThinkBlocks(content: string): ParsedPart[] {
  const normalized = stripOrphanThinkClosings(content)
  const res: ParsedPart[] = []
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g
  let lastIndex = 0
  let match

  while ((match = thinkRegex.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      res.push({ type: "text", content: normalized.slice(lastIndex, match.index) })
    }
    res.push({ type: "think", content: match[1] })
    lastIndex = match.index + match[0].length
  }

  const remaining = normalized.slice(lastIndex)
  const openThinkIndex = remaining.indexOf("<think>")

  if (openThinkIndex !== -1) {
    if (openThinkIndex > 0) res.push({ type: "text", content: remaining.slice(0, openThinkIndex) })
    res.push({
      type: "think",
      content: remaining.slice(openThinkIndex + 7),
      unfinished: true,
    })
  } else if (remaining) {
    res.push({ type: "text", content: remaining })
  }

  return res
}

function shouldAnimateGeneratedText(text: string): boolean {
  if (!text.trim()) return false
  return !/```|`|\[[^\]]+\]\([^)]+\)|(^|\n)\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)|\|.*\|/m.test(text)
}

export function StreamingText({
  text,
  isBusy,
}: {
  text: string
  isBusy: boolean
}) {
  const displayText = useThrottledValue(text, 40)
  const [isUpdateFading, setIsUpdateFading] = useState(false)
  const hasMountedRef = useRef(false)
  // Capture the text that was already present when this component mounted.
  // TextGenerateEffect uses this to skip animation for pre-existing content.
  const initialTextRef = useRef(text)

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    setIsUpdateFading(true)
    const timer = window.setTimeout(() => setIsUpdateFading(false), 220)
    return () => window.clearTimeout(timer)
  }, [displayText])

  const parts = useMemo(() => parseThinkBlocks(displayText), [displayText])

  if (!displayText && !isBusy) return null

  if (parts.length === 0 && isBusy) {
    return (
      <div className="prose-container relative min-h-[1.5em]">
        <span className="inline-block w-1.5 h-4 bg-primary/60 rounded-full animate-pulse align-middle" />
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-3 overflow-anchor-auto min-h-[1.5em] transition-opacity duration-300 ${isUpdateFading ? "opacity-55" : "opacity-100"}`}>
      {parts.map((p, i) => {
        const isLast = i === parts.length - 1
        return (
          <div key={`${p.type}-${i}`}>
            {p.type === "think" ? (
              <ThinkBlock content={p.content} isStreaming={p.unfinished && isBusy} />
            ) : (
              <div className="prose-container relative">
                {shouldAnimateGeneratedText(p.content) ? (
                  <TextGenerateEffect
                    words={p.content}
                    className="whitespace-pre-wrap leading-7 text-foreground/90"
                    wordClassName="text-foreground/90"
                    duration={0.18}
                    initialText={initialTextRef.current}
                  />
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={MarkdownComponents}
                  >
                    {p.content}
                  </ReactMarkdown>
                )}
                {isBusy && isLast && (
                  <span className="inline-block w-1.5 h-4 ml-1 bg-primary/60 rounded-full animate-pulse align-middle" />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

