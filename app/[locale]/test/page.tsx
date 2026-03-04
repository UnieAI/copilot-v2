"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SymmetricGlowFlow() {
    const [status, setStatus] = useState<"idle" | "flowing" | "active">("idle");

    const handleTrigger = () => {
        if (status !== "idle") return;

        setStatus("flowing");

        // 2.5秒後流動完成，轉為全螢幕邊框保持
        setTimeout(() => {
            setStatus("active");
        }, 2500);

        // 保持3秒後消失
        setTimeout(() => {
            setStatus("idle");
        }, 6000);
    };

    // 動態路徑定義
    const transition = { duration: 2.5, ease: "easeInOut" };

    return (
        <div className="relative min-h-screen w-full bg-[#020202] flex items-center justify-center overflow-hidden">

            {/* --- SVG 光流層 --- */}
            <div className="fixed inset-0 z-50 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* 路徑 A: 左上 -> 右上 -> 右下 */}
                    <motion.path
                        d="M 0,0 L 100,0 L 100,100"
                        fill="transparent"
                        stroke="rgba(59, 130, 246, 0.8)"
                        strokeWidth="0.5"
                        strokeLinecap="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={status === "flowing" ? { pathLength: 1, opacity: 1 } : { opacity: 0 }}
                        transition={transition}
                        style={{
                            // 關鍵：用 drop-shadow 創造純光暈，掩蓋掉細微的實線
                            filter: "blur(2px) drop-shadow(0 0 8px rgba(37, 99, 235, 1)) drop-shadow(0 0 20px rgba(37, 99, 235, 0.6))",
                        }}
                    />

                    {/* 路徑 B: 左上 -> 左下 -> 右下 */}
                    <motion.path
                        d="M 0,0 L 0,100 L 100,100"
                        fill="transparent"
                        stroke="rgba(59, 130, 246, 0.8)"
                        strokeWidth="0.5"
                        strokeLinecap="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={status === "flowing" ? { pathLength: 1, opacity: 1 } : { opacity: 0 }}
                        transition={transition}
                        style={{
                            filter: "blur(2px) drop-shadow(0 0 8px rgba(37, 99, 235, 1)) drop-shadow(0 0 20px rgba(37, 99, 235, 0.6))",
                        }}
                    />
                </svg>
            </div>

            {/* --- 最終擬合：全螢幕邊框滲光 --- */}
            <AnimatePresence>
                {status === "active" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        className="fixed inset-0 z-40 pointer-events-none"
                    >
                        {/* 純陰影滲透，完全無邊框 */}
                        <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(37,99,235,0.7)] blur-[10px]" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- 按鈕內容 --- */}
            <div className="z-10 flex flex-col items-center">
                <button
                    onClick={handleTrigger}
                    disabled={status !== "idle"}
                    // 這裡改用反引號 ` ，就可以支援多行書寫
                    className={`relative px-12 py-4 bg-white/5 border border-white/10 rounded-full 
    text-blue-400 tracking-[0.3em] font-light hover:bg-blue-500/10 
    transition-all active:scale-95 group overflow-hidden`}
                >
                    <span className="relative z-10">
                        {status === "idle" ? "INIT_FLOW_SCAN" : "FLOWING..."}
                    </span>
                    {/* 按鈕內部的流動光裝飾 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                </button>
            </div>

            <style jsx>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
        </div>
    );
}