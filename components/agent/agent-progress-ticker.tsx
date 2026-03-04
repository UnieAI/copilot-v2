"use client"

import { useEffect, useMemo, useState } from "react"

const PHRASES = [
  "working...",
  "thinking...",
  "generating...",
  "planning...",
  "analyzing...",
  "reasoning...",
  "checking...",
  "drafting...",
  "executing...",
  "finalizing...",
] as const

export function AgentProgressTicker({ className = "" }: { className?: string }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % PHRASES.length)
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  const text = useMemo(() => PHRASES[index], [index])

  return (
    <div className={`flex items-center gap-2 text-[11px] text-muted-foreground/80 ${className}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/70 animate-pulse" />
      <span key={text} className="inline-block animate-in fade-in duration-300">
        {text}
      </span>
    </div>
  )
}
