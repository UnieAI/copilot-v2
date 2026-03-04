"use client"

import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { X } from "lucide-react"

interface AgentCleanupOverlayProps {
    agentFetch: (url: string, init?: RequestInit) => Promise<Response>
    onDone: () => void
}

export function AgentCleanupOverlay({ agentFetch, onDone }: AgentCleanupOverlayProps) {
    const didRun = useRef(false)

    useEffect(() => {
        if (didRun.current) return
        didRun.current = true

        const MIN_DISPLAY_MS = 2000
        Promise.all([
            agentFetch("/api/agent/providers/clear", { method: "POST" }).catch(() => { }),
            new Promise<void>((resolve) => setTimeout(resolve, MIN_DISPLAY_MS)),
        ]).finally(onDone)
    }, [agentFetch, onDone])

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className="flex flex-col items-center gap-5"
            >
                {/* Icon */}
                <div className="relative flex items-center justify-center h-16 w-16 rounded-2xl border border-muted-foreground/30 bg-muted/40 shadow-lg">
                    <X className="h-7 w-7 text-muted-foreground" />
                </div>

                {/* Text */}
                <div className="flex flex-col items-center gap-1.5 text-center">
                    <p className="text-base font-semibold text-foreground tracking-tight">
                        正在關閉 Agent
                    </p>
                    <p className="text-sm text-muted-foreground">
                        清理 Provider 設定中…
                    </p>
                </div>

                {/* Dots */}
                <div className="flex items-center gap-1.5">
                    {[0, 150, 300].map((delay) => (
                        <span
                            key={delay}
                            className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                            style={{ animationDelay: `${delay}ms` }}
                        />
                    ))}
                </div>
            </motion.div>
        </motion.div>
    )
}
