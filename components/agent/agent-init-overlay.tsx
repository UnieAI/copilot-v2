"use client"

import { motion } from "framer-motion"
import { Bot, Loader2 } from "lucide-react"

export function AgentInitOverlay() {
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
                <div className="relative flex items-center justify-center h-16 w-16 rounded-2xl border border-primary/30 bg-primary/10 shadow-lg shadow-primary/10">
                    <Bot className="h-8 w-8 text-primary" />
                    {/* pulse ring */}
                    <span className="absolute inset-0 rounded-2xl animate-ping bg-primary/20 duration-1000" />
                </div>

                {/* Text */}
                <div className="flex flex-col items-center gap-1.5 text-center">
                    <p className="text-base font-semibold text-foreground tracking-tight">
                        正在初始化 Agent
                    </p>
                    <p className="text-sm text-muted-foreground">
                        同步 API Provider 到 Agent 引擎，請稍候…
                    </p>
                </div>

                {/* Dots */}
                <div className="flex items-center gap-1.5">
                    {[0, 150, 300].map((delay) => (
                        <span
                            key={delay}
                            className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
                            style={{ animationDelay: `${delay}ms` }}
                        />
                    ))}
                </div>
            </motion.div>
        </motion.div>
    )
}
