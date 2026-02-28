"use client"

import { useEffect, useRef } from "react"
import { AlertTriangle } from "lucide-react"

interface ConfirmDialogProps {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: "danger" | "default"
    onConfirm: () => void
    onCancel: () => void
}

export function ConfirmDialog({
    title,
    message,
    confirmLabel = "確認",
    cancelLabel = "取消",
    variant = "danger",
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const cancelRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        cancelRef.current?.focus()
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel()
        }
        document.addEventListener("keydown", handler)
        return () => document.removeEventListener("keydown", handler)
    }, [onCancel])

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={e => { if (e.target === e.currentTarget) onCancel() }}
        >
            <div className="w-full max-w-sm mx-4 bg-background rounded-2xl border border-border shadow-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
                <div className="px-6 pt-6 pb-4 flex gap-4">
                    {variant === "danger" && (
                        <div className="shrink-0 h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                        </div>
                    )}
                    <div className="space-y-1">
                        <h3 className="font-semibold text-sm">{title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 px-6 pb-5">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={onCancel}
                        className="h-9 px-4 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`h-9 px-4 rounded-xl text-sm font-medium transition-all active:scale-95 ${variant === "danger"
                                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                : "bg-primary text-primary-foreground hover:bg-primary/90"
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
