"use client"

import { useState, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Brain, ChevronUp, ChevronDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { MarkdownCode } from "@/components/chat/markdown-code"

// ─── Think Tag Parser ──────────────────────────────────────────────────
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

// ─── Gemini Style Markdown Components ────────────────────────────────
export const MarkdownComponents: any = {
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
            <table className="w-full border-collapse text-sm text-left">
                {children}
            </table>
        </div>
    ),
    thead: ({ children }: any) => <thead className="bg-muted/50 border-b border-border/40">{children}</thead>,
    th: ({ children }: any) => <th className="px-4 py-3 font-semibold text-foreground/80">{children}</th>,
    td: ({ children }: any) => <td className="px-4 py-3 border-b border-border/20 last:border-0">{children}</td>,

    a: ({ href, children }: any) => {
        const isYouTube = href && (
            href.includes('youtube.com/watch') ||
            href.includes('youtu.be/')
        );

        if (isYouTube) {
            let videoId = '';

            const url = new URL(href);
            if (url.hostname.includes('youtube.com')) {
                videoId = url.searchParams.get('v') || '';
            }
            else if (url.hostname === 'youtu.be') {
                videoId = url.pathname.slice(1);
            }

            if (videoId) {
                const embedUrl = `https://www.youtube.com/embed/${videoId}${url.search ? url.search : ''}`;

                return (
                    <div className="my-4 aspect-video w-full max-w-3xl mx-auto rounded-xl overflow-hidden border border-border shadow-sm">
                        <iframe
                            width="100%"
                            height="100%"
                            src={embedUrl}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                        ></iframe>
                    </div>
                );
            }
        }

        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium underline underline-offset-4 hover:text-primary/80 transition-colors"
            >
                {children}
            </a>
        );
    },

    code: ({ node, inline, className, children, ...props }: any) => {
        const content = String(children).replace(/\n$/, "");
        const hasNewline = content.includes("\n");
        const language = className?.replace(/language-/, "");

        if (!hasNewline && !language) {
            return (
                <code
                    className="
                        mx-1 rounded-md px-1.5 py-0.5
                        bg-muted/80 dark:bg-white/10
                        text-primary dark:text-primary-foreground
                        font-mono text-[0.85em] font-bold
                        border border-border/40
                        break-all
                    "
                    {...props}
                >
                    {content}
                </code>
            );
        }

        return (
            <MarkdownCode
                className={className}
                language={language}
                codeText={content}
                {...props}
            />
        );
    }
};

// ─── Message Content with Think Block Support ────────────────────────
export function MessageContent({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
    const parts = useMemo(() => {
        const res: { type: 'text' | 'think'; content: string; unfinished?: boolean }[] = [];
        let buffer = content;

        const firstThinkOpen = buffer.indexOf('<think>');
        const firstThinkClose = buffer.indexOf('</think>');

        if (firstThinkOpen === -1 && firstThinkClose === -1) {
            res.push({ type: 'text', content: buffer });
            return res;
        }

        if (firstThinkOpen !== -1 && (firstThinkOpen < firstThinkClose || firstThinkClose === -1)) {
            const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
            let lastIndex = 0;
            let match;

            while ((match = thinkRegex.exec(buffer)) !== null) {
                if (match.index > lastIndex) {
                    res.push({ type: 'text', content: buffer.slice(lastIndex, match.index) });
                }
                res.push({ type: 'think', content: match[1] });
                lastIndex = match.index + match[0].length;
            }

            const remaining = buffer.slice(lastIndex);
            const openThinkIndex = remaining.indexOf('<think>');

            if (openThinkIndex !== -1) {
                if (openThinkIndex > 0) {
                    res.push({ type: 'text', content: remaining.slice(0, openThinkIndex) });
                }
                res.push({
                    type: 'think',
                    content: remaining.slice(openThinkIndex + 7),
                    unfinished: true,
                });
            } else if (remaining) {
                res.push({ type: 'text', content: remaining });
            }

            return res;
        }

        if (firstThinkOpen === -1 && firstThinkClose !== -1) {
            const thinkContent = buffer.slice(0, firstThinkClose);
            const afterThink = buffer.slice(firstThinkClose + 8);

            if (thinkContent.trim()) {
                res.push({ type: 'think', content: thinkContent });
            }

            if (afterThink.trim()) {
                res.push({ type: 'text', content: afterThink });
            }

            return res;
        }

        res.push({ type: 'text', content: buffer });
        return res;
    }, [content]);

    return (
        <div className="flex flex-col gap-3 overflow-anchor-auto min-h-[1.5em]">
            {parts.map((p, i) => {
                const isLast = i === parts.length - 1;
                return (
                    <div
                        key={`${p.type}-${i}`}
                        className={cn(
                            "transition-opacity duration-300",
                            isStreaming && isLast ? "opacity-100" : "opacity-100"
                        )}
                    >
                        {p.type === 'think' ? (
                            <ThinkBlock content={p.content} isStreaming={p.unfinished && isStreaming} />
                        ) : (
                            <div className="prose-container relative">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                    components={MarkdownComponents}
                                >
                                    {p.content}
                                </ReactMarkdown>
                                {isStreaming && isLast && (
                                    <span className="inline-block w-1.5 h-4 ml-1 bg-primary/60 rounded-full animate-pulse vertical-middle" />
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
