import type { ReactNode } from "react"

export function PanelCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border">
      <div className="border-b border-border px-4 py-3">
        <div className="text-sm font-medium">{title}</div>
        {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function EmptyCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
      <div className="mb-1 text-sm font-medium text-muted-foreground">{title}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </div>
  )
}

export function InfoList({
  items,
}: {
  items: Array<[string, string]>
}) {
  return (
    <div className="space-y-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-4 text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="break-all text-right font-medium">{value}</span>
        </div>
      ))}
    </div>
  )
}
