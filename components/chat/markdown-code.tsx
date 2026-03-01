"use client"

import { useState, useEffect } from "react"
import { Highlight, themes } from "prism-react-renderer"
import { useTheme } from "next-themes"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Terminal, Copy, Check, Maximize2, X, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function MarkdownCode({ className, codeText, language, ...props }: any) {
    const { resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [copied, setCopied] = useState(false)
    const [open, setOpen] = useState(false)

    useEffect(() => setMounted(true), [])

    const prismTheme = resolvedTheme === "dark" ? themes.vsDark : themes.vsLight
    const displayLanguage = language || "code";

    const handleCopy = async () => {
        await navigator.clipboard.writeText(codeText)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    if (!mounted) {
        return (
            <div className="my-4 rounded-2xl border bg-muted/20 p-4 font-mono text-sm animate-pulse">
                <code>{codeText.slice(0, 100)}...</code>
            </div>
        )
    }

    return (
        <div className="not-prose group relative my-6 flex flex-col overflow-hidden rounded-[24px] border border-border bg-card shadow-sm hover:shadow-md transition-all dark:border-white/10 dark:bg-[#1E1F20]">
            {/* Header: Gemini Style */}
            <div className="flex items-center justify-between px-5 py-3 shrink-0 bg-muted/30 dark:bg-[#1E1F20]/80 border-b border-border/50">
                <div className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Terminal className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] uppercase text-muted-foreground/80">
                        <span>{displayLanguage}</span>
                        <ChevronRight className="h-3 w-3 opacity-30" />
                        <span className="font-sans lowercase opacity-50">snippet</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleCopy} className={cn(
                        "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all border active:scale-95",
                        copied ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" : "bg-background border-border hover:bg-muted"
                    )}>
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copied ? "已複製" : "複製"}</span>
                    </button>
                    <button onClick={() => setOpen(true)} className="h-8 w-8 flex items-center justify-center rounded-full border border-border bg-background hover:bg-muted transition-all opacity-0 group-hover:opacity-100 hidden sm:flex">
                        <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Code Content with Line Numbers */}
            <div className="relative w-full overflow-hidden bg-card dark:bg-[#0B0D0E]">
                <Highlight theme={prismTheme} code={codeText} language={displayLanguage as any}>
                    {({ className, style, tokens, getLineProps, getTokenProps }) => (
                        <pre
                            className={cn(className, "overflow-auto p-5 text-[13px] leading-[22px] font-mono custom-scrollbar !m-0 w-full selection:bg-primary/30")}
                            style={{ ...style, backgroundColor: 'transparent' }}
                        >
                            {tokens.map((line, i) => (
                                <div key={i} {...getLineProps({ line, key: i })} className="table-row">
                                    <span className="table-cell pr-5 text-muted-foreground/20 text-right select-none text-[10px] w-10 font-sans border-r border-white/5 whitespace-nowrap">
                                        {i + 1}
                                    </span>
                                    <span className="table-cell pl-4 whitespace-pre">
                                        {line.map((token, key) => <span key={key} {...getTokenProps({ token, key })} />)}
                                    </span>
                                </div>
                            ))}
                        </pre>
                    )}
                </Highlight>
            </div>
        </div>
    )
}