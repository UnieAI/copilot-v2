"use client"

import { useState } from "react"
import { Step1 } from "./step1/step1"
import { Step2 } from "./step2"
import { Session } from "next-auth"

export const SimpleChatRoomForm = ({
  session
}: {
  session: Session
}) => {
  const [step, setStep] = useState<"setup" | "chat">("setup")
  const [systemPrompt, setSystemPrompt] = useState<string>("")
  const [importedMessages, setImportedMessages] = useState<any[]>([])

  const handleNext = (messages?: any[]) => {
    setStep("chat")
    if (messages) {
      setImportedMessages(messages)
    }
  }

  const handleRestart = () => {
    setStep("setup")
    setSystemPrompt("")
    setImportedMessages([])
  }

  if (step === "setup") {
    return <Step1 session={session} systemPrompt={systemPrompt} setSystemPrompt={setSystemPrompt} onNext={handleNext} />
  }

  return <Step2 session={session} systemPrompt={systemPrompt} onRestart={handleRestart} importedMessages={importedMessages} />
}
