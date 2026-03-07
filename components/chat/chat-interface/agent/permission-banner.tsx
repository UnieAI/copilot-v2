"use client"

import { useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import type { PermissionRequest } from "./types"

export function PermissionBanner({
  request,
  onReply,
}: {
  request: PermissionRequest
  onReply: (reply: "once" | "always" | "reject") => Promise<void>
}) {
  const [responding, setResponding] = useState(false)

  const handleReply = async (reply: "once" | "always" | "reject") => {
    setResponding(true)
    try {
      await onReply(reply)
    } finally {
      setResponding(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl mx-4 mb-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground mb-1">
            Permission Required
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            {request.permission}
          </div>
          {request.patterns.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {request.patterns.map((pattern, i) => (
                <code
                  key={i}
                  className="text-xs bg-muted/60 px-1.5 py-0.5 rounded text-foreground/80 break-all"
                >
                  {pattern}
                </code>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleReply("reject")}
              disabled={responding}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted/60 transition-colors disabled:opacity-50"
            >
              Deny
            </button>
            <button
              onClick={() => handleReply("always")}
              disabled={responding}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted/60 transition-colors disabled:opacity-50"
            >
              Always Allow
            </button>
            <button
              onClick={() => handleReply("once")}
              disabled={responding}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {responding ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Allow Once"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
