"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { AttachmentProgress } from "@/lib/stream-store"
import ShinyText from "@/components/ui/ShinyText"

export function StatusBadge({ text }: { text: string }) {
    if (!text) return null
    return (
        <div className="flex items-center gap-2 py-2">
            <div className="flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{text}</span>
            </div>
        </div>
    )
}

export const CircularProgress = ({ progress, colorClass }: { progress: number, colorClass: string }) => {
    const radius = 9;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center w-5 h-5">
            <svg className="w-full h-full -rotate-90">
                <circle cx="10" cy="10" r={radius} className="stroke-muted/30 fill-none" strokeWidth="2" />
                <motion.circle
                    cx="10" cy="10" r={radius}
                    className={`fill-none ${colorClass}`}
                    strokeWidth="2"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                />
            </svg>
        </div>
    );
};

export function AttachmentsProgressPanel({ attachments }: { attachments: AttachmentProgress[] }) {
    if (!attachments || attachments.length === 0) return null

    const statusLabel = (s: AttachmentProgress['status']) => {
        switch (s) {
            case 'queued': return '排隊中'
            case 'parsing': return '解析中'
            case 'vlm': return '分析中'
            case 'done': return '完成'
            case 'error': return '失敗'
        }
    }
    const statusColor = (s: AttachmentProgress['status']) => {
        switch (s) {
            case 'queued': return 'text-muted-foreground bg-muted/60'
            case 'parsing': return 'text-blue-600 bg-blue-500/10'
            case 'vlm': return 'text-violet-600 bg-violet-500/10'
            case 'done': return 'text-emerald-600 bg-emerald-500/10'
            case 'error': return 'text-red-500 bg-red-500/10'
        }
    }
    const dotColor = (s: AttachmentProgress['status']) => {
        switch (s) {
            case 'queued': return 'bg-muted-foreground/40'
            case 'parsing': return 'bg-blue-500 animate-pulse'
            case 'vlm': return 'bg-violet-500 animate-pulse'
            case 'done': return 'bg-emerald-500'
            case 'error': return 'bg-red-500'
        }
    }

    const getFileExt = (name: string) => {
        const parts = name.split('.')
        return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'FILE'
    }

    const [aiSubStatus, setAiSubStatus] = useState('分析排版中')
    useEffect(() => {
        const statuses = ['分析排版中', '擷取關鍵內容', '辨識圖片語義', '思考提取策略', '整合跨頁資訊']
        let i = 0
        const timer = setInterval(() => {
            i = (i + 1) % statuses.length
            setAiSubStatus(statuses[i])
        }, 6000)
        return () => clearInterval(timer)
    }, [])


    return (
        <div className="flex flex-col gap-2 px-4 w-full items-center">
            <div className="flex flex-col gap-2 px-4 w-3/4">
                {attachments.map((att, i) => {
                    const isPdf = att.mimeType === 'application/pdf'
                    const isImage = att.mimeType.startsWith('image/')
                    const hasPages = isPdf && att.status === 'vlm' && att.totalPages != null
                    const progressPct = hasPages && att.totalPages!
                        ? Math.round(((att.completedPages ?? 0) / att.totalPages!) * 100)
                        : 0

                    return (
                        <motion.div
                            key={`${att.name}-${i}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.2 }}
                            className="flex items-center gap-3 bg-muted/40 border border-border/50 rounded-2xl px-4 py-2.5"
                        >
                            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                                <span className="text-[9px] font-bold text-muted-foreground tracking-wider">
                                    {isImage ? 'IMG' : getFileExt(att.name)}
                                </span>
                            </div>

                            <div className="flex-1 min-w-0">
                                <ShinyText text={att.name} />
                                {hasPages && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-violet-500 rounded-full"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progressPct}%` }}
                                                transition={{ duration: 0.3 }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-muted-foreground shrink-0">
                                            {att.completedPages ?? 0}/{att.totalPages} 頁
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold ${statusColor(att.status)}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${dotColor(att.status)}`} />
                                {statusLabel(att.status)}
                            </div>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}
