"use client"

import {
    type ReactElement,
    type ReactNode,
    cloneElement,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { AnimatePresence, motion } from "framer-motion"

type GlowStatus = "active" | "idle"

export type AgentGlowOptions = {
    color?: string
    secondaryColor?: string
    holdMs?: number
    borderRadius?: number
}

type AgentGlowContextValue = {
    triggerGlow: (options?: AgentGlowOptions) => void
    isAnimating: boolean
}

type ActiveGlow = Required<AgentGlowOptions> & {
    id: number
}

const DEFAULT_GLOW: Required<AgentGlowOptions> = {
    color: "rgba(139, 92, 246, 0.95)",      // 藍紫色
    secondaryColor: "rgba(37, 99, 235, 0.8)",
    holdMs: 1500,                         // 駐留時間
    borderRadius: 40,                     // 邊框圓角
}

const AgentGlowContext = createContext<AgentGlowContextValue | null>(null)

export function AgentGlowProvider({ children }: { children: ReactNode }) {
    const [activeGlow, setActiveGlow] = useState<ActiveGlow | null>(null)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    const clearTimers = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
    }, [])

    const triggerGlow = useCallback(
        (options?: AgentGlowOptions) => {
            const merged = { ...DEFAULT_GLOW, ...(options || {}) }
            clearTimers()

            const id = Date.now()
            setActiveGlow({ ...merged, id })

            // 設定駐留後自動消失
            timerRef.current = setTimeout(() => {
                setActiveGlow((prev) => (prev?.id === id ? null : prev))
            }, merged.holdMs)
        },
        [clearTimers]
    )

    useEffect(() => {
        return () => clearTimers()
    }, [clearTimers])

    const contextValue = useMemo(() => ({
        triggerGlow,
        isAnimating: activeGlow !== null
    }), [triggerGlow, activeGlow])

    return (
        <AgentGlowContext.Provider value={contextValue}>
            {children}

            <AnimatePresence>
                {activeGlow && (
                    <motion.div
                        // 1. 出現動畫：稍微快一點的淡入
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        // 2. 離開動畫：較長的淡出，營造優雅感
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="fixed inset-0 z-[999] pointer-events-none overflow-hidden"
                    >
                        {/* 擬合全螢幕的邊框滲光 */}
                        <div
                            className="absolute inset-0"
                            style={{
                                borderRadius: `${activeGlow.borderRadius}px`,
                                // 內滲透光與外發光組合
                                boxShadow: `
                                    inset 0 0 80px 10px ${activeGlow.color},
                                    inset 0 0 30px 5px ${activeGlow.secondaryColor},
                                    0 0 20px rgba(139, 92, 246, 0.3)
                                `,
                                filter: "blur(12px)",
                                // 確保不顯示任何實體 Border
                                border: "none"
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </AgentGlowContext.Provider>
    )
}

export function useAgentGlow() {
    const context = useContext(AgentGlowContext)
    if (!context) throw new Error("useAgentGlow must be used within AgentGlowProvider.")
    return context
}

// ---------------------------------------------------------
// Wrapper 組件
// ---------------------------------------------------------
export default function GlowFlowWrapper({
    children,
    triggerOnClick = true,
    ...options
}: AgentGlowOptions & { children: ReactElement; triggerOnClick?: boolean }) {
    const { triggerGlow, isAnimating } = useAgentGlow()

    const handleClick = (e: React.MouseEvent) => {
        if (children.props.onClick) children.props.onClick(e)
        if (triggerOnClick) {
            triggerGlow(options)
        }
    }

    return cloneElement(children, {
        onClick: handleClick,
        // 動畫中可以選擇是否禁用
        disabled: children.props.disabled || isAnimating
    })
}