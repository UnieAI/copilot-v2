"use client"

import { useEffect, useState } from "react"
import { ChevronRight, Loader2, Check, X } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { TextShimmer } from "../text-shimmer"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface BasicToolProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  summary?: string
  status?: string
  children?: React.ReactNode
  defaultOpen?: boolean
  lockWhilePending?: boolean
}

export function BasicTool({
  icon: Icon,
  title,
  subtitle,
  summary,
  status,
  children,
  defaultOpen = false,
  lockWhilePending = false,
}: BasicToolProps) {
  const [open, setOpen] = useState(defaultOpen)
  const pending = status === "pending" || status === "running"

  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])

  const handleOpenChange = (value: boolean) => {
    if (pending && lockWhilePending) return
    setOpen(value)
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <div
        className={cn(
          "rounded-xl border border-border/60 bg-card/60 transition-colors",
          open ? "border-border bg-card" : "hover:border-border hover:bg-card/80",
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            className="flex w-full items-start gap-3 px-3 py-3 text-left"
            disabled={pending && !children}
          >
            <StatusIcon status={status} fallbackIcon={Icon} />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground/90">
                  {pending ? <TextShimmer text={title} /> : title}
                </span>
                <StatusBadge status={status} />
              </div>
              {/* {subtitle && (
                <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                  {subtitle}
                </div>
              )} */}
              {summary && (
                <div className="text-xs leading-5 text-foreground/80 whitespace-pre-wrap break-words">
                  {summary}
                </div>
              )}
            </div>
            {children && !(pending && lockWhilePending) && (
              <ChevronRight
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200 ${open ? "rotate-90" : ""
                  }`}
              />
            )}
          </button>
        </CollapsibleTrigger>
        {children && (
          <CollapsibleContent>
            <div className="border-t border-border/60 px-3 pb-3 pt-3">{children}</div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  )
}

function StatusIcon({
  status,
  fallbackIcon: FallbackIcon,
}: {
  status?: string
  fallbackIcon: LucideIcon
}) {
  if (status === "pending" || status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
  }
  if (status === "completed") {
    return <Check className="h-4 w-4 text-emerald-500 shrink-0" />
  }
  if (status === "error") {
    return <X className="h-4 w-4 text-red-500 shrink-0" />
  }
  return <FallbackIcon className="h-4 w-4 text-muted-foreground shrink-0" />
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null

  const tone =
    status === "completed"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
      : status === "error"
        ? "bg-red-500/10 text-red-600 dark:text-red-300"
        : status === "pending" || status === "running"
          ? "bg-blue-500/10 text-blue-600 dark:text-blue-300"
          : "bg-muted text-muted-foreground"

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone,
      )}
    >
      {status === "completed" ? "done" : status}
    </span>
  )
}
