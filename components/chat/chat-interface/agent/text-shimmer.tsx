export function TextShimmer({ text }: { text: string }) {
  return <span className="animate-pulse text-muted-foreground">{text}</span>
}
