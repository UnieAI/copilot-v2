import path from "path"

const WORKSPACE_QUERY_KEYS = new Set(["path", "directory", "cwd", "dirs"])
const WORKSPACE_BODY_PATH_KEYS = new Set(["path", "directory", "cwd"])

function normalizeRoot(root: string) {
  const normalized = path.posix.normalize(root || "/workspace")
  return normalized.startsWith("/") ? normalized : `/${normalized}`
}

function normalizeRoots(roots: string | string[]) {
  const items = Array.isArray(roots) ? roots : [roots]
  return items.map((root) => normalizeRoot(root))
}

function invalidPathError(label: string) {
  return new Error(`invalid ${label}`)
}

export function toWorkspaceRelativePath(
  input: string,
  workdir: string,
  options?: {
    allowEmpty?: boolean
    label?: string
  },
) {
  const allowEmpty = options?.allowEmpty ?? true
  const label = options?.label || "path"
  const normalizedWorkdir = normalizeRoot(workdir)
  const rawValue = String(input || "").trim()
  const normalizedInput = path.posix.normalize(rawValue || "")

  if (!normalizedInput || normalizedInput === ".") {
    if (allowEmpty) return ""
    throw invalidPathError(label)
  }

  if (normalizedInput === normalizedWorkdir) {
    if (allowEmpty) return ""
    throw invalidPathError(label)
  }

  if (normalizedInput.startsWith(`${normalizedWorkdir}/`)) {
    return normalizedInput.slice(normalizedWorkdir.length + 1)
  }

  if (normalizedInput.startsWith("/")) {
    throw invalidPathError(label)
  }

  const trimmed = normalizedInput.replace(/^\.\/+/, "").replace(/^\/+/, "")
  if (!trimmed || trimmed === ".") {
    if (allowEmpty) return ""
    throw invalidPathError(label)
  }

  if (
    trimmed === ".." ||
    trimmed.startsWith("../") ||
    trimmed.includes("/../") ||
    trimmed.endsWith("/..")
  ) {
    throw invalidPathError(label)
  }

  return trimmed
}

export function sanitizeReadableSandboxPath(
  input: string,
  roots: string | string[],
  options?: {
    allowEmpty?: boolean
    label?: string
  },
) {
  const allowEmpty = options?.allowEmpty ?? true
  const label = options?.label || "path"
  const normalizedRoots = normalizeRoots(roots)
  const primaryRoot = normalizedRoots[0]
  const rawValue = String(input || "").trim()
  const normalizedInput = path.posix.normalize(rawValue || "")

  if (!normalizedInput || normalizedInput === ".") {
    if (allowEmpty) return ""
    throw invalidPathError(label)
  }

  for (let index = 0; index < normalizedRoots.length; index += 1) {
    const root = normalizedRoots[index]
    if (normalizedInput === root) {
      if (index === 0) return ""
      return root
    }
    if (normalizedInput.startsWith(`${root}/`)) {
      if (index === 0) {
        return normalizedInput.slice(primaryRoot.length + 1)
      }
      return normalizedInput
    }
  }

  if (normalizedInput.startsWith("/")) {
    throw invalidPathError(label)
  }

  const trimmed = normalizedInput.replace(/^\.\/+/, "").replace(/^\/+/, "")
  if (!trimmed || trimmed === ".") {
    if (allowEmpty) return ""
    throw invalidPathError(label)
  }

  if (
    trimmed === ".." ||
    trimmed.startsWith("../") ||
    trimmed.includes("/../") ||
    trimmed.endsWith("/..")
  ) {
    throw invalidPathError(label)
  }

  return trimmed
}

export function resolveReadableSandboxLocation(
  input: string,
  roots: string | string[],
  options?: {
    allowEmpty?: boolean
    label?: string
  },
) {
  const normalizedRoots = normalizeRoots(roots)
  const rawValue = String(input || "").trim()
  const normalizedInput = path.posix.normalize(rawValue || "")

  if (!normalizedInput || normalizedInput === ".") {
    if (options?.allowEmpty ?? true) {
      return {
        root: normalizedRoots[0],
        relativePath: "",
      }
    }
    throw invalidPathError(options?.label || "path")
  }

  for (const root of normalizedRoots) {
    if (normalizedInput === root) {
      return {
        root,
        relativePath: "",
      }
    }
    if (normalizedInput.startsWith(`${root}/`)) {
      return {
        root,
        relativePath: normalizedInput.slice(root.length + 1),
      }
    }
  }

  if (normalizedInput.startsWith("/")) {
    throw invalidPathError(options?.label || "path")
  }

  return {
    root: normalizedRoots[0],
    relativePath: sanitizeReadableSandboxPath(normalizedInput, normalizedRoots[0], options),
  }
}

export function toReadableSandboxAbsolutePath(
  input: string,
  roots: string | string[],
  options?: {
    allowEmpty?: boolean
    label?: string
  },
) {
  const normalizedRoots = normalizeRoots(roots)
  const primaryRoot = normalizedRoots[0]
  const sanitized = sanitizeReadableSandboxPath(input, normalizedRoots, options)
  if (!sanitized) return primaryRoot
  if (sanitized.startsWith("/")) return sanitized
  return path.posix.join(primaryRoot, sanitized)
}

export function toWorkspaceAbsolutePath(
  input: string,
  workdir: string,
  options?: {
    allowEmpty?: boolean
    label?: string
  },
) {
  const relativePath = toWorkspaceRelativePath(input, workdir, options)
  return relativePath ? path.posix.join(workdir, relativePath) : workdir
}

function sanitizePathList(value: string, workdir: string, label: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) =>
      toWorkspaceRelativePath(item, workdir, {
        allowEmpty: false,
        label,
      }),
    )
    .join(",")
}

function sanitizeReadablePathList(value: string, roots: string | string[], label: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) =>
      sanitizeReadableSandboxPath(item, roots, {
        allowEmpty: false,
        label,
      }),
    )
    .join(",")
}

function shouldSanitizeBody(targetPath: string) {
  return (
    targetPath.startsWith("/file") ||
    targetPath.startsWith("/find/file") ||
    targetPath.includes("/shell") ||
    targetPath.includes("/command")
  )
}

export function sanitizeWorkspaceQuery(
  query: Record<string, string>,
  workdir: string,
  options?: {
    readRoots?: string[]
  },
) {
  const nextQuery: Record<string, string> = { ...query }
  const readRoots = options?.readRoots?.length ? options.readRoots : [workdir]

  for (const [key, value] of Object.entries(nextQuery)) {
    if (!WORKSPACE_QUERY_KEYS.has(key) || typeof value !== "string") continue

    if (key === "dirs") {
      nextQuery[key] = sanitizeReadablePathList(value, readRoots, key)
      continue
    }

    nextQuery[key] = sanitizeReadableSandboxPath(value, readRoots, {
      allowEmpty: true,
      label: key,
    })
  }

  return nextQuery
}

function sanitizeWorkspaceBodyValue(
  value: unknown,
  workdir: string,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeWorkspaceBodyValue(item, workdir))
  }

  if (!value || typeof value !== "object") {
    return value
  }

  const nextValue: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string" && WORKSPACE_BODY_PATH_KEYS.has(key)) {
      nextValue[key] = toWorkspaceRelativePath(entry, workdir, {
        allowEmpty: true,
        label: key,
      })
      continue
    }

    if (typeof entry === "string" && key === "dirs") {
      nextValue[key] = sanitizePathList(entry, workdir, key)
      continue
    }

    nextValue[key] = sanitizeWorkspaceBodyValue(entry, workdir)
  }

  return nextValue
}

export function sanitizeWorkspaceBody(
  targetPath: string,
  body: unknown,
  workdir: string,
) {
  if (!shouldSanitizeBody(targetPath)) {
    return body
  }

  return sanitizeWorkspaceBodyValue(body, workdir)
}

export function getSandboxWritablePaths(workdir: string, homeDir: string) {
  return [workdir, homeDir, "/tmp", "/run"]
}
