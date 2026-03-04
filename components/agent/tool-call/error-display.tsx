"use client"

export function ErrorDisplay({ error }: { error: string }) {
  const message = error.replace(/^Error:\s*/i, "")

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-sm text-destructive break-words font-medium">{message}</p>
    </div>
  )
}
