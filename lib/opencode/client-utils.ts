import type { SelectedInstance } from "@/hooks/use-instance-store"

export function appendInstanceParams(
  url: string,
  instance: SelectedInstance | null
): string {
  if (!instance) return url

  const separator = url.includes("?") ? "&" : "?"
  let result = `${url}${separator}port=${encodeURIComponent(instance.port)}`
  if (instance.hostname) {
    result += `&hostname=${encodeURIComponent(instance.hostname)}`
  }
  return result
}
