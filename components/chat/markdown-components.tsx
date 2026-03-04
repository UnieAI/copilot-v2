import { useState, useRef, useEffect, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Brain, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { MarkdownCode } from "@/components/chat/markdown-code"
import { TextGenerateEffect } from "@/components/ui/text-generate-effect"

// ─── Think Tag Parser ──────────────────────────────────────────────────
export function ThinkBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
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
    // 標題：稍微加粗，帶有層次感
    h1: ({ children }: any) => <h1 className="text-xl font-bold mt-6 mb-2 text-foreground">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-lg font-semibold mt-5 mb-2 text-foreground/90">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-base font-semibold mt-4 mb-1 text-foreground/80">{children}</h3>,

    // 段落：增加行高，讓閱讀不吃力
    p: ({ children }: any) => <p className="leading-7 mb-4 last:mb-0 text-foreground/90">{children}</p>,

    // 清單：Gemini 風格的間距
    ul: ({ children }: any) => <ul className="list-disc pl-6 mb-4 space-y-2 text-foreground/90">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-foreground/90">{children}</ol>,
    li: ({ children }: any) => <li className="leading-7">{children}</li>,

    // 引用：左側紫色/藍色漸層條
    blockquote: ({ children }: any) => (
        <blockquote className="border-l-4 border-primary/30 pl-4 py-1 my-4 italic bg-primary/5 rounded-r-lg text-muted-foreground">
            {children}
        </blockquote>
    ),

    // 表格：這是最難搞的部分，幫你做成 Gemini 的簡潔風
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

    // 連結
    a: ({ href, children }: any) => {
        // 判斷是否為 YouTube 連結
        const isYouTube = href && (
            href.includes('youtube.com/watch') ||
            href.includes('youtu.be/')
        );

        if (isYouTube) {
            // 從各種常見 YouTube URL 格式提取 video ID
            let videoId = '';

            // 標準格式：https://www.youtube.com/watch?v=VIDEO_ID
            const url = new URL(href);
            if (url.hostname.includes('youtube.com')) {
                videoId = url.searchParams.get('v') || '';
            }
            // 短網址：https://youtu.be/VIDEO_ID
            else if (url.hostname === 'youtu.be') {
                videoId = url.pathname.slice(1);
            }

            if (videoId) {
                // 保留 ?si=... 或其他參數（可選）
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

        // 不是 YouTube 就照原樣渲染一般連結
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

    // 行內程式碼：淡色背景與圓角
    code: ({ node, inline, className, children, ...props }: any) => {
        // 核心邏輯：將內容轉為字串並檢查是否有換行符
        const content = String(children).replace(/\n$/, "");
        const hasNewline = content.includes("\n");
        const language = className?.replace(/language-/, "");

        // 如果沒有換行符，且不是明確的語言標籤開頭，則判定為 Inline Code
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

        // 否則，渲染為整塊的代碼卡片 (Block Code)
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

export function shouldAnimateGeneratedText(text: string): boolean {
    if (!text.trim()) return false
    return !/```|`|\[[^\]]+\]\([^)]+\)|(^|\n)\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)|\|.*\|/m.test(text)
}

export function stripOrphanThinkClosings(input: string): string {
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

export function MessageContent({
    content,
    isStreaming,
    animateDuringStreaming = false,
    useTextGenerateEffect = true,
}: {
    content: string
    isStreaming?: boolean
    animateDuringStreaming?: boolean
    useTextGenerateEffect?: boolean
}) {
    const [isUpdateFading, setIsUpdateFading] = useState(false)
    const hasMountedRef = useRef(false)

    useEffect(() => {
        if (!hasMountedRef.current) {
            hasMountedRef.current = true
            return
        }
        setIsUpdateFading(true)
        const timer = window.setTimeout(() => setIsUpdateFading(false), 220)
        return () => window.clearTimeout(timer)
    }, [content])

    // 使用 useMemo 解析內容，確保只有內容變動時才重新計算 parts
    const parts = useMemo(() => {
        const normalized = stripOrphanThinkClosings(content)
        const res: { type: 'text' | 'think'; content: string; unfinished?: boolean }[] = [];
        let buffer = content;

        // 先找第一個 <think> 或 </think>
        const firstThinkOpen = buffer.indexOf('<think>');
        const firstThinkClose = buffer.indexOf('</think>');

        if (firstThinkOpen === -1 && firstThinkClose === -1) {
            // 完全沒有 think 標籤 → 全當 text
            res.push({ type: 'text', content: buffer });
            return res;
        }

        // 情況1：有 <think> 開頭 → 走原本邏輯（已能處理）
        if (firstThinkOpen !== -1 && (firstThinkOpen < firstThinkClose || firstThinkClose === -1)) {
            // 使用原本的 regex 方式處理多個成對的 <think>...</think>
            const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
            let lastIndex = 0;
            let match;

            while ((match = thinkRegex.exec(normalized)) !== null) {
                if (match.index > lastIndex) {
                    res.push({ type: 'text', content: normalized.slice(lastIndex, match.index) });
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

        // 情況2：沒有 <think> 但有 </think> → 把 </think> 之前全部當 think
        if (firstThinkOpen === -1 && firstThinkClose !== -1) {
            const thinkContent = buffer.slice(0, firstThinkClose);
            const afterThink = buffer.slice(firstThinkClose + 8); // 跳過 </think>
            const remaining = normalized.slice(firstThinkClose + 8);
            const openThinkIndex = remaining.indexOf('<think>');

            // To mimic the exact behavior of the original without the syntax error:
            if (thinkContent.trim()) {
                res.push({ type: 'think', content: thinkContent });
            }

            if (afterThink.trim()) {
                res.push({ type: 'text', content: afterThink });
            }

            return res;
        }

        // 其他混合情況（理論上已被上面兩個分支涵蓋，但保留防呆）
        res.push({ type: 'text', content: buffer });
        return res;
    }, [content]);

    return (
        <div className={cn(
            "flex flex-col gap-3 overflow-anchor-auto min-h-[1.5em] transition-opacity duration-300",
            isUpdateFading ? "opacity-55" : "opacity-100"
        )}>
            {parts.map((p, i) => {
                const isLast = i === parts.length - 1;
                return (
                    <div
                        key={`${p.type}-${i}`}
                        className="transition-opacity duration-300"
                    >
                        {p.type === 'think' ? (
                            <ThinkBlock content={p.content} isStreaming={p.unfinished && isStreaming} />
                        ) : (
                            <div className="prose-container relative">
                                {useTextGenerateEffect && (animateDuringStreaming || !isStreaming) && shouldAnimateGeneratedText(p.content) ? (
                                    <TextGenerateEffect
                                        words={p.content}
                                        className="whitespace-pre-wrap leading-7 text-foreground/90"
                                        wordClassName="text-foreground/90"
                                        duration={0.18}
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
                                {/* 流式游標 (Gemini Style) */}
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
