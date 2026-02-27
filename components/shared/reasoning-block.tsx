"use client"

import { useState } from "react"

// 思考區塊元件
export const ReasoningBlock = ({ reason }: { reason: string }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false)

  if (!reason.trim()) {
    return <></>
  }

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)} className="text-sm opacity-40 hover:opacity-60">
        {isOpen ? "close ▲" : "reasoning ▼"}
      </button>
      {isOpen && (
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-500"
          dangerouslySetInnerHTML={{ __html: reason }}
        />
      )}
    </div>
  )
}
