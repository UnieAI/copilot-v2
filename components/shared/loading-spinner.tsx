import { Loader2 } from "lucide-react"
import { cn } from "../../lib/utils"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "default" | "dots" | "ring" | "pulse" | "circle-dots"
  className?: string
}

export default function LoadingSpinner({ size = "md", variant = "default", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12",
  }

  if (variant === "default") {
    return <Loader2 className={cn("animate-spin text-gray-500", sizeClasses[size], className)} />
  }

  if (variant === "dots") {
    return (
      <div className={cn("flex space-x-1", className)}>
        <div
          className={cn(
            "bg-gray-500 rounded-full animate-bounce",
            size === "sm" ? "w-1 h-1" : size === "md" ? "w-2 h-2" : size === "lg" ? "w-3 h-3" : "w-4 h-4",
          )}
          style={{ animationDelay: "0ms" }}
        />
        <div
          className={cn(
            "bg-gray-500 rounded-full animate-bounce",
            size === "sm" ? "w-1 h-1" : size === "md" ? "w-2 h-2" : size === "lg" ? "w-3 h-3" : "w-4 h-4",
          )}
          style={{ animationDelay: "150ms" }}
        />
        <div
          className={cn(
            "bg-gray-500 rounded-full animate-bounce",
            size === "sm" ? "w-1 h-1" : size === "md" ? "w-2 h-2" : size === "lg" ? "w-3 h-3" : "w-4 h-4",
          )}
          style={{ animationDelay: "300ms" }}
        />
      </div>
    )
  }

  if (variant === "ring") {
    return (
      <div
        className={cn(
          "animate-spin rounded-full border-2 border-gray-200 border-t-gray-500",
          sizeClasses[size],
          className,
        )}
      />
    )
  }

  if (variant === "pulse") {
    return <div className={cn("animate-pulse bg-gray-500 rounded-full", sizeClasses[size], className)} />
  }

  if (variant === "circle-dots") {
    const dotCount = 8
    const dotSize = size === "sm" ? "w-1 h-1" : size === "md" ? "w-1.5 h-1.5" : size === "lg" ? "w-2 h-2" : "w-3 h-3"
    const containerSize =
      size === "sm" ? "w-6 h-6" : size === "md" ? "w-8 h-8" : size === "lg" ? "w-12 h-12" : "w-16 h-16"

    return (
      <div className={cn("relative", containerSize, className)}>
        {Array.from({ length: dotCount }).map((_, i) => {
          const angle = (i * 360) / dotCount
          const delay = i * 100
          return (
            <div
              key={i}
              className={cn("absolute bg-gray-400 rounded-full animate-pulse", dotSize)}
              style={{
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${
                  size === "sm" ? "12px" : size === "md" ? "16px" : size === "lg" ? "24px" : "32px"
                }) rotate(-${angle}deg)`,
                animationDelay: `${delay}ms`,
                animationDuration: "800ms",
              }}
            />
          )
        })}
      </div>
    )
  }

  return null
}
