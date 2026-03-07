"use client"

import { useState, useEffect } from "react"
import { Highlight, themes } from "prism-react-renderer"
import { useTheme } from "next-themes"
import { Terminal, Copy, Check, Maximize2, Minimize2, X, ChevronRight, Eye, Code, ScreenShare } from "lucide-react"
import { cn } from "@/lib/utils"
import { MermaidRenderer } from "./mermaid-renderer"  // 請確認這個匯入路徑正確

export function MarkdownCode({ className, codeText, language, ...props }: any) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Mermaid 相關狀態
  const [showSource, setShowSource] = useState(false)     // false = 顯示圖表（預設）
  const [mermaidError, setMermaidError] = useState(false)

  useEffect(() => setMounted(true), [])

  const prismTheme = resolvedTheme === "dark" ? themes.vsDark : themes.vsLight
  const displayLanguage = language || "code"
  const normalizedLanguage = language?.toLowerCase()
  const isMermaid = normalizedLanguage === "mermaid"
  const isHtml = normalizedLanguage === "html"
  const hasPreviewMode = isMermaid || isHtml
  const previewAvailable = !showSource && (!isMermaid || !mermaidError)

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

  // 共用的高亮程式碼渲染函式
  const renderHighlightedCode = (fullscreen = false) => (
    <Highlight theme={prismTheme} code={codeText} language={displayLanguage as any}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={cn(
            className,
            "overflow-auto p-5 text-[13px] leading-[22px] font-mono custom-scrollbar !m-0 w-full selection:bg-primary/30",
            !fullscreen && !expanded && "max-h-[28rem]",
            !fullscreen && expanded && "max-h-[75vh]",
          )}
          style={{ ...style, backgroundColor: 'transparent' }}
        >
          {tokens.map((line, i) => {
            const lineProps = getLineProps({ line })

            return (
              <div key={i} {...lineProps} className={cn(lineProps.className, "table-row")}>
                <span className="table-cell pr-5 text-muted-foreground/20 text-right select-none text-[10px] w-10 font-sans border-r border-white/5 whitespace-nowrap">
                  {i + 1}
                </span>
                <span className="table-cell pl-4 whitespace-pre">
                  {line.map((token, key) => {
                    const tokenProps = getTokenProps({ token })
                    return <span key={key} {...tokenProps} />
                  })}
                </span>
              </div>
            )
          })}
        </pre>
      )}
    </Highlight>
  )

  const renderPreviewContent = (fullscreen = false) => {
    if (isMermaid && !showSource && !mermaidError) {
      return (
        <MermaidRenderer
          chart={codeText}
          className={fullscreen ? "w-full h-full" : "w-full min-h-[140px]"}
          enableFullscreen={false}
          onError={() => setMermaidError(true)}
        />
      )
    }

    if (isHtml && !showSource) {
      return (
        <iframe
          srcDoc={codeText}
          title="HTML preview"
          sandbox=""
          className={cn(
            "w-full rounded-2xl border border-border bg-white",
            fullscreen ? "h-full min-h-[70vh]" : expanded ? "h-[75vh]" : "h-[360px]",
          )}
        />
      )
    }

    return renderHighlightedCode(fullscreen)
  }

  return (
    <div
      className={cn(
        "not-prose group relative my-6 flex flex-col overflow-hidden rounded-[24px] border border-border bg-card shadow-sm hover:shadow-md transition-all dark:border-white/10 dark:bg-[#1E1F20]",
        className
      )}
    >
      {/* Header */}
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
          <button
            onClick={() => setExpanded((value) => !value)}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all border active:scale-95 bg-background border-border hover:bg-muted"
            title={expanded ? "收合內容高度" : "展開內容高度"}
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span>{expanded ? "收合" : "展開"}</span>
          </button>

          {/* 複製按鈕 */}
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all border active:scale-95",
              copied
                ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                : "bg-background border-border hover:bg-muted"
            )}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "已複製" : "複製"}</span>
          </button>

          {/* Preview / source toggle */}
          {hasPreviewMode && (
            <div className="flex items-center gap-0.5 bg-muted/50 rounded-full p-0.5 border border-border/50">
              <button
                onClick={() => setShowSource(false)}
                className={cn(
                  "h-7 w-7 flex items-center justify-center rounded-full transition-colors",
                  !showSource && !mermaidError
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/80"
                )}
                title={isHtml ? "顯示預覽" : "顯示圖表"}
              >
                <Eye className="h-4 w-4" />
              </button>

              <button
                onClick={() => setShowSource(true)}
                className={cn(
                  "h-7 w-7 flex items-center justify-center rounded-full transition-colors",
                  showSource || mermaidError
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/80"
                )}
                title="顯示原始碼"
              >
                <Code className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* 全螢幕按鈕 */}
          {hasPreviewMode && previewAvailable && (
            <button
              onClick={() => setOpen(true)}
              className="h-8 w-8 flex items-center justify-center rounded-full border border-border bg-background hover:bg-muted transition-all opacity-0 group-hover:opacity-100 hidden sm:flex"
              title="全螢幕預覽"
            >
              <ScreenShare className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 內容區域 */}
      <div className="relative w-full overflow-hidden bg-card dark:bg-[#0B0D0E]">
        {isMermaid ? (
          showSource || mermaidError ? (
            // 原始碼模式
            renderHighlightedCode()
          ) : (
            // 圖表模式
            <div className="p-5">
              {renderPreviewContent()}
            </div>
          )
        ) : isHtml ? (
          showSource ? (
            renderHighlightedCode()
          ) : (
            <div className="p-4">
              {renderPreviewContent()}
            </div>
          )
        ) : (
          // 一般程式碼
          renderHighlightedCode()
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] bg-background">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
              <div className="text-lg font-medium">
                {displayLanguage} {isMermaid && !showSource ? "(Diagram)" : isHtml && !showSource ? "(Preview)" : ""}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-muted"
                title="關閉全螢幕"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-card p-6">
              {renderPreviewContent(true)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
