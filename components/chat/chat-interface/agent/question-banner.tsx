"use client"

import { useState } from "react"
import { MessageSquare, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { QuestionRequest, QuestionAnswer } from "./types"

export function QuestionBanner({
  request,
  onReply,
  onReject,
}: {
  request: QuestionRequest
  onReply: (answers: QuestionAnswer[]) => Promise<void>
  onReject: () => Promise<void>
}) {
  const [tab, setTab] = useState(0)
  const [answers, setAnswers] = useState<QuestionAnswer[]>(
    request.questions.map(() => []),
  )
  const [customInput, setCustomInput] = useState("")
  const [sending, setSending] = useState(false)

  const question = request.questions[tab]
  if (!question) return null

  const isLast = tab >= request.questions.length - 1
  const isMulti = question.multiple === true

  const selectOption = (label: string) => {
    setAnswers((prev) => {
      const next = [...prev]
      if (isMulti) {
        const current = next[tab] || []
        if (current.includes(label)) {
          next[tab] = current.filter((a) => a !== label)
        } else {
          next[tab] = [...current, label]
        }
      } else {
        next[tab] = [label]
      }
      return next
    })
  }

  const submitCustom = () => {
    if (!customInput.trim()) return
    const value = customInput.trim()
    setAnswers((prev) => {
      const next = [...prev]
      if (isMulti) {
        const current = next[tab] || []
        next[tab] = current.includes(value) ? current : [...current, value]
      } else {
        next[tab] = [value]
      }
      return next
    })
    setCustomInput("")
  }

  const handleNext = async () => {
    if (isLast) {
      setSending(true)
      try {
        await onReply(answers)
      } finally {
        setSending(false)
      }
    } else {
      setTab(tab + 1)
    }
  }

  const handleReject = async () => {
    setSending(true)
    try {
      await onReject()
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !sending) {
          void handleReject()
        }
      }}
    >
      <DialogContent className="w-[min(92vw,900px)] max-w-[92vw] gap-0 overflow-hidden p-0">
        <div className="flex max-h-[85vh] flex-col">
          <DialogHeader className="border-b border-border/70 px-4 py-3 pr-10">
            {request.questions.length > 1 && (
              <div className="text-[10px] text-muted-foreground">
                Question {tab + 1} of {request.questions.length}
              </div>
            )}
            <DialogTitle className="mt-1 flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4 shrink-0 text-blue-500" />
              <span className="break-words">{question.header}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
            <div className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {question.question}
            </div>

            {question.options.length > 0 && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {question.options.map((opt, i) => {
                  const picked = answers[tab]?.includes(opt.label) ?? false
                  return (
                    <button
                      key={i}
                      onClick={() => selectOption(opt.label)}
                      disabled={sending}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                        picked
                          ? "border-blue-500/50 bg-blue-500/10 text-foreground"
                          : "border-border hover:bg-muted/50 text-foreground/80"
                      } disabled:opacity-50`}
                    >
                      <div className="font-medium break-words">{opt.label}</div>
                      {opt.description && (
                        <div className="mt-0.5 break-words text-muted-foreground">
                          {opt.description}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {question.custom !== false && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      submitCustom()
                    }
                  }}
                  placeholder="Type your answer..."
                  disabled={sending}
                  className="w-full min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
                <button
                  onClick={submitCustom}
                  disabled={sending || !customInput.trim()}
                  className="w-full rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/60 disabled:opacity-50 sm:w-auto"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border/70 bg-background px-4 py-3">
            <button
              onClick={handleReject}
              disabled={sending}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/60 disabled:opacity-50"
            >
              Dismiss
            </button>
            {tab > 0 && (
              <button
                onClick={() => setTab(tab - 1)}
                disabled={sending}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/60 disabled:opacity-50"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={sending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isLast ? (
                "Submit"
              ) : (
                "Next"
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
