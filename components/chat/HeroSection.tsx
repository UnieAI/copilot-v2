"use client"

import React from 'react'
import { motion, Variants } from 'framer-motion'
import { Search, FileText, Code2, Image as ImageIcon } from 'lucide-react'
import { cn } from "@/lib/utils"
import { DynamicGreeting } from '../ui/dynamic-greeting'

// --- 動畫變體定義 (解決 TS 2322 錯誤) ---
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.12, // 讓子元件一個接一個出現
            delayChildren: 0.2
        }
    }
}

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1] // Gemini 專用的流暢曲線
        }
    }
}

interface HeroSectionProps {
    t: (key: string) => string; // 假設翻譯 function 的型別
}

export function HeroSection({ t }: HeroSectionProps) {
    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex-1 flex flex-col relative z-[1] justify-center mt-12 mb-16"
        >
            <div className="w-full max-w-4xl mx-auto flex flex-col items-center text-center px-6">

                {/* 1. 標題區域：動態流光文字 */}
                <motion.div variants={itemVariants} className="mb-6">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight">
                        <span className="inline-block bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-x pb-2">
                            <DynamicGreeting />
                        </span>
                    </h1>
                </motion.div>

                {/* 2. 副標題：優雅的排版 */}
                <motion.p
                    variants={itemVariants}
                    className="mt-2 text-base sm:text-lg text-muted-foreground/80 dark:text-zinc-400 font-normal max-w-xl leading-relaxed"
                >
                    {t('subtitle')}
                </motion.p>

                {/* 3. 建議標籤組 (Suggestion Chips) */}
                <motion.div
                    variants={itemVariants}
                    className="mt-12 flex flex-wrap justify-center gap-3 max-w-2xl"
                >
                    <SuggestionChip
                        icon={<Search className="w-4 h-4" />}
                        label={t('research')}
                        color="text-blue-500"
                    />
                    <SuggestionChip
                        icon={<FileText className="w-4 h-4" />}
                        label={t('documents')}
                        color="text-emerald-500"
                    />
                    <SuggestionChip
                        icon={<Code2 className="w-4 h-4" />}
                        label={t('code')}
                        color="text-amber-500"
                    />
                    <SuggestionChip
                        icon={<ImageIcon className="w-4 h-4" />}
                        label={t('images')}
                        color="text-purple-500"
                    />
                </motion.div>

            </div>
        </motion.div>
    )
}

// --- 內部組件：建議標籤 ---
function SuggestionChip({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
    return (
        <motion.div
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
                "group flex items-center gap-2.5 px-4 py-3 rounded-2xl cursor-pointer transition-all duration-300 backdrop-blur-md border shadow-sm",
                // 明亮主題：輕柔、乾淨
                "bg-white/60 border-zinc-200 text-zinc-700 hover:bg-white hover:border-zinc-300 hover:shadow-md",
                // 暗色主題：深邃、玻璃感
                "dark:bg-zinc-900/40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
            )}
        >
            <span className={cn("opacity-80 group-hover:opacity-100 transition-opacity", color)}>
                {icon}
            </span>
            <span className="text-sm font-medium tracking-wide">
                {label}
            </span>
        </motion.div>
    )
}