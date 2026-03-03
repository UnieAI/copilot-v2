"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Settings, AlertTriangle, X } from "lucide-react"

interface SetupWarningDialogProps {
  title: string
  items?: string[]
  actionLabel?: string
  actionPath?: string
  confirmLabel?: string
  onClose: () => void
}

function SetupWarningDialog({
  title,
  items = [],
  actionLabel,
  actionPath,
  confirmLabel = "確定",
  onClose,
}: SetupWarningDialogProps) {
  const router = useRouter()
  const closeRef = useRef<HTMLButtonElement>(null)
  const hasAction = Boolean(actionLabel && actionPath)

  useEffect(() => {
    closeRef.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md mx-4 bg-background rounded-2xl border border-border shadow-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
        <div className="px-6 pt-6 pb-2 flex gap-4">
          <div className="shrink-0 h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="font-semibold text-sm">{title}</h3>
            {items.length > 0 && (
              <ul className="space-y-1">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="shrink-0 p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {hasAction ? (
          <div className="flex items-center justify-end gap-2 px-6 py-4">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              稍後再說
            </button>
            <button
              onClick={() => {
                router.push(actionPath!)
                onClose()
              }}
              className="h-9 px-4 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Settings className="h-3.5 w-3.5" />
              {actionLabel}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end px-6 py-4">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
            >
              {confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface SetupCheckerProps {
  userRole: string
}

type DialogState = { open: boolean; items: string[] }

export function SetupChecker({ userRole }: SetupCheckerProps) {
  const pathname = usePathname()
  const [adminDialog, setAdminDialog] = useState<DialogState>({ open: false, items: [] })
  const [providerDialog, setProviderDialog] = useState<DialogState>({ open: false, items: [] })
  const [userSystemDialogOpen, setUserSystemDialogOpen] = useState(false)
  const dismissedRef = useRef<Set<string>>(new Set())
  const dismissedKey = useCallback((kind: "admin-issues" | "user-system-model" | "provider-issue") => {
    return `${kind}:${pathname}`
  }, [pathname])

  const checkSetup = useCallback(async () => {
    try {
      const res = await fetch("/api/setup-check")
      const data = await res.json()

      setAdminDialog({ open: false, items: [] })
      setProviderDialog({ open: false, items: [] })
      setUserSystemDialogOpen(false)

      if (data.adminIssues?.length) {
        if (dismissedRef.current.has(dismissedKey("admin-issues"))) return
        setAdminDialog({ open: true, items: data.adminIssues })
      } else if (userRole === "user" && data.systemModelIssue) {
        if (dismissedRef.current.has(dismissedKey("user-system-model"))) return
        setUserSystemDialogOpen(true)
      } else if (data.providerIssue) {
        if (dismissedRef.current.has(dismissedKey("provider-issue"))) return
        setProviderDialog({
          open: true,
          items: ["目前尚未設定可用的模型 Provider，請先完成設定後再使用。"],
        })
      }
    } catch {
      // Ignore setup check failure and avoid blocking the UI.
    }
  }, [dismissedKey, userRole])

  useEffect(() => {
    checkSetup()
  }, [pathname, checkSetup])

  return (
    <>
      {adminDialog.open && (
        <SetupWarningDialog
          title="系統設定尚未完成，請先補齊以下項目"
          items={adminDialog.items}
          actionLabel="前往系統設定"
          actionPath="/admin/settings"
          onClose={() => {
            dismissedRef.current.add(dismissedKey("admin-issues"))
            setAdminDialog({ open: false, items: [] })
          }}
        />
      )}

      {!adminDialog.open && userSystemDialogOpen && (
        <SetupWarningDialog
          title="系統模型設定尚未完成，請等待管理員進行設定"
          confirmLabel="確定"
          onClose={() => {
            dismissedRef.current.add(dismissedKey("user-system-model"))
            setUserSystemDialogOpen(false)
          }}
        />
      )}

      {!adminDialog.open && !userSystemDialogOpen && providerDialog.open && (
        <SetupWarningDialog
          title="模型 Provider 尚未設定"
          items={providerDialog.items}
          actionLabel="前往設定"
          actionPath="/settings"
          onClose={() => {
            dismissedRef.current.add(dismissedKey("provider-issue"))
            setProviderDialog({ open: false, items: [] })
          }}
        />
      )}
    </>
  )
}
