"use client"

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"

type AgentModeContextValue = {
  /** Whether agent mode is active — ONLY changes via activateAgent / deactivateAgent */
  isAgentMode: boolean
  /** Call when user clicks the agent toggle ON */
  activateAgent: () => void
  /** Call when user clicks the agent toggle OFF */
  deactivateAgent: () => void
  /** Monotonically increasing counter — bumps on each activateAgent call.
   *  Use this as a useEffect dependency to trigger model sync exactly once per activation. */
  activationCount: number
}

const AgentModeContext = createContext<AgentModeContextValue>({
  isAgentMode: false,
  activateAgent: () => {},
  deactivateAgent: () => {},
  activationCount: 0,
})

export function AgentModeProvider({ children }: { children: ReactNode }) {
  const [isAgentMode, setIsAgentMode] = useState(false)
  const [activationCount, setActivationCount] = useState(0)

  const activateAgent = useCallback(() => {
    setIsAgentMode(true)
    setActivationCount((c) => c + 1)
  }, [])

  const deactivateAgent = useCallback(() => {
    setIsAgentMode(false)
  }, [])

  return (
    <AgentModeContext.Provider value={{ isAgentMode, activateAgent, deactivateAgent, activationCount }}>
      {children}
    </AgentModeContext.Provider>
  )
}

export function useAgentMode() {
  return useContext(AgentModeContext)
}
