"use client"

import { useState, useEffect } from "react"
import { Highlight, themes } from "prism-react-renderer"
import { useTheme } from "next-themes"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Terminal, Copy, Check, Maximize2, X, ChevronRight, Eye, Code } from "lucide-react"
import { cn } from "@/lib/utils"
import { MermaidRenderer } from "./mermaid-renderer"  // 請確認這個匯入路徑正確

export function MarkdownCode({ className, codeText, language, ...props }: any) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  // Mermaid 相關狀態
  const [showSource, setShowSource] = useState(false)     // false = 顯示圖表（預設）
  const [mermaidError, setMermaidError] = useState(false)

  useEffect(() => setMounted(true), [])

  const prismTheme = resolvedTheme === "dark" ? themes.vsDark : themes.vsLight
  const displayLanguage = language || "code"
  const isMermaid = language?.toLowerCase() === "mermaid"

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
  const renderHighlightedCode = () => (
    <Highlight theme={prismTheme} code={codeText} language={displayLanguage as any}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={cn(
            className,
            "overflow-auto p-5 text-[13px] leading-[22px] font-mono custom-scrollbar !m-0 w-full selection:bg-primary/30"
          )}
          style={{ ...style, backgroundColor: 'transparent' }}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line, key: i })} className="table-row">
              <span className="table-cell pr-5 text-muted-foreground/20 text-right select-none text-[10px] w-10 font-sans border-r border-white/5 whitespace-nowrap">
                {i + 1}
              </span>
              <span className="table-cell pl-4 whitespace-pre">
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token, key })} />
                ))}
              </span>
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  )

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

          {/* Mermaid 切換按鈕 - 永遠顯示在 header（當是 mermaid 時） */}
          {isMermaid && (
            <div className="flex items-center gap-0.5 bg-muted/50 rounded-full p-0.5 border border-border/50">
              {/* 圖表模式按鈕 */}
              <button
                onClick={() => setShowSource(false)}
                className={cn(
                  "h-7 w-7 flex items-center justify-center rounded-full transition-colors",
                  !showSource && !mermaidError
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/80"
                )}
                title="顯示圖表"
              >
                <Eye className="h-4 w-4" />
              </button>

              {/* 原始碼模式按鈕 */}
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

          {/* 全螢幕按鈕 - 只在顯示圖表時出現 */}
          {/* {(!isMermaid || (isMermaid && !showSource && !mermaidError)) && (
            <button
              onClick={() => setOpen(true)}
              className="h-8 w-8 flex items-center justify-center rounded-full border border-border bg-background hover:bg-muted transition-all opacity-0 group-hover:opacity-100 hidden sm:flex"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )} */}
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
              <MermaidRenderer
                chart={codeText}
                className="w-full min-h-[140px]"
                enableFullscreen={true}
                onError={() => setMermaidError(true)}
              />
            </div>
          )
        ) : (
          // 一般程式碼
          renderHighlightedCode()
        )}
      </div>

      {/* 全螢幕對話框 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] w-full h-[90vh] p-0 overflow-hidden">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b">
              <DialogTitle className="text-lg font-medium">
                {displayLanguage} {isMermaid && !showSource && "(Diagram)"}
              </DialogTitle>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-card">
              {isMermaid && !showSource ? (
                <MermaidRenderer
                  chart={codeText}
                  className="w-full h-full"
                  enableFullscreen={false}
                />
              ) : (
                renderHighlightedCode()
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}