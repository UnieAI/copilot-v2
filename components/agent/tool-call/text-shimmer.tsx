"use client"

import { cn } from "@/lib/utils"

export function TextShimmer({
  children,
  className,
  active = true,
}: {
  children: React.ReactNode
  className?: string
  active?: boolean
}) {
  if (!active) {
    return <span className={className}>{children}</span>
  }

  return (
    <span
      className={cn(
        "inline-block bg-gradient-to-r from-foreground via-foreground/60 to-foreground bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer",
        className
      )}
    >
      {children}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 2.5s ease-in-out infinite;
        }
      `}</style>
    </span>
  )
}
