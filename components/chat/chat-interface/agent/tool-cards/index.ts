import type { ComponentType } from "react"
import type { ToolPart } from "../types"
import {
  Terminal,
  FileEdit,
  FilePlus,
  Eye,
  Search,
  FileSearch,
  Globe,
  ListTree,
  FileCode,
  Zap,
  MessageSquare,
  type LucideIcon,
} from "lucide-react"

export type ToolCardProps = {
  part: ToolPart
  defaultOpen?: boolean
  onOpenSubAgent?: (sessionId: string) => void
}

export type ToolInfo = {
  icon: LucideIcon
  title: string
  subtitle?: string
}

export function getToolInfo(
  tool: string,
  input: Record<string, unknown> = {},
): ToolInfo {
  switch (tool) {
    case "read":
      return {
        icon: Eye,
        title: "Read",
        subtitle: input.filePath
          ? getFilename(input.filePath as string)
          : undefined,
      }
    case "list":
      return {
        icon: ListTree,
        title: "List",
        subtitle: input.path
          ? getFilename(input.path as string)
          : undefined,
      }
    case "glob":
      return {
        icon: FileSearch,
        title: "Glob",
        subtitle: input.pattern as string | undefined,
      }
    case "grep":
      return {
        icon: Search,
        title: "Grep",
        subtitle: input.pattern as string | undefined,
      }
    case "webfetch":
      return {
        icon: Globe,
        title: "Web Fetch",
        subtitle: input.url as string | undefined,
      }
    case "task":
    case "agent":
      return {
        icon: ListTree,
        title: `Agent: ${input.subagent_type || "task"}`,
        subtitle:
          (input.description as string | undefined) ||
          (input.prompt as string | undefined),
      }
    case "bash":
      return {
        icon: Terminal,
        title: "Shell",
        subtitle: input.description as string | undefined,
      }
    case "edit":
      return {
        icon: FileEdit,
        title: "Edit",
        subtitle: input.filePath
          ? getFilename(input.filePath as string)
          : undefined,
      }
    case "write":
      return {
        icon: FilePlus,
        title: "Write",
        subtitle: input.filePath
          ? getFilename(input.filePath as string)
          : undefined,
      }
    case "apply_patch":
      return {
        icon: FileCode,
        title: "Apply Patch",
        subtitle: Array.isArray(input.files)
          ? `${input.files.length} file${input.files.length !== 1 ? "s" : ""}`
          : undefined,
      }
    case "skill":
      return {
        icon: Zap,
        title: (input.name as string) || "Skill",
      }
    case "question":
      return {
        icon: MessageSquare,
        title: "Questions",
      }
    default:
      return {
        icon: FileCode,
        title: tool,
      }
  }
}

function getFilename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/")
  return parts[parts.length - 1] || path
}

export const CONTEXT_GROUP_TOOLS = new Set(["read", "glob", "grep", "list"])
export const HIDDEN_TOOLS = new Set(["todowrite", "todoread"])
