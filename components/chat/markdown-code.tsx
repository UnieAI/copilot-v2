"use client"

import { useMemo, useState, type HTMLAttributes } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Terminal, Code2, Copy, Check, Maximize2, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

type MarkdownCodeProps = HTMLAttributes<HTMLElement> & {
    inline?: boolean
}

export function MarkdownCode({ inline, className, children, ...props }: MarkdownCodeProps) {
    const [copied, setCopied] = useState(false)
    const [open, setOpen] = useState(false)

    // Normalize children to a string so we can copy and avoid extra trailing newline from markdown.
    const codeText = useMemo(() => {
        const raw = Array.isArray(children) ? children.join("") : children ?? ""
        const text = typeof raw === "string" ? raw : String(raw)
        return inline ? text : text.replace(/\n$/, "")
    }, [children, inline])

    const language = typeof className === "string"
        ? className.match(/language-([\w-]+)/)?.[1]
        : undefined

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(codeText)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
        } catch { }
    }

    if (inline) {
        return (
            <code
                className={cn("rounded bg-muted px-1.5 py-[2px] font-mono text-[13px]", className)}
                {...props}
            >
                {codeText}
            </code>
        )
    }

    const Header = ({ compact }: { compact?: boolean }) => (
        <div className={cn(
            "flex items-center justify-between px-3 py-2 text-[12px]",
            compact ? "border-b border-border/70 bg-background/60 dark:bg-background/80" : "border-b border-border/60 bg-muted/40"
        )}>
            <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                    {language ? <Terminal className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
                </div>
                <div className="flex flex-col leading-none">
                    <span className="text-[12px] font-semibold text-foreground">{language || "code"}</span>
                    <span className="text-[11px] text-muted-foreground/80">Markdown snippet</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleCopy}
                    className={cn(
                        "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
                        copied
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                </button>
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="hidden sm:inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold bg-muted text-muted-foreground hover:text-foreground transition"
                >
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span>Expand</span>
                </button>
            </div>
        </div>
    )

    const CodeSurface = ({ large }: { large?: boolean }) => (
        <div className={cn("relative", large ? "h-[70vh]" : "max-h-[420px]")}>
            <pre className={cn(
                "h-full w-full overflow-auto bg-card px-4 py-3 text-[13px] leading-relaxed scrollbar-hide",
                large ? "rounded-b-2xl" : ""
            )}>
                <code className={cn("font-mono whitespace-pre", className)} {...props}>
                    {codeText}
                </code>
            </pre>
            {!large && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
            )}
        </div>
    )

    return (
        <>
            <div className="not-prose my-4 overflow-hidden rounded-2xl border border-border bg-background/50 shadow-sm">
                <Header />
                <CodeSurface />
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden rounded-2xl">
                    <DialogTitle className="sr-only">Code preview</DialogTitle>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key="code-modal"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col h-full"
                        >
                            <Header compact />
                            <CodeSurface large />
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow-sm hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                                <span className="sr-only">Close</span>
                            </button>
                        </motion.div>
                    </AnimatePresence>
                </DialogContent>
            </Dialog>
        </>
    )
}
