import { execFile } from "child_process"
import { mkdtemp, readFile, rm } from "fs/promises"
import { tmpdir } from "os"
import path from "path"
import { promisify } from "util"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const execFileAsync = promisify(execFile)
const CONTAINER_NAME = process.env.OPENCODE_CONTAINER_NAME || "opencode-agent"
const CONTAINER_WORKDIR = process.env.OPENCODE_CONTAINER_WORKDIR || "/workspace"

function normalizeRelativePath(input: string) {
  const normalized = path.posix.normalize(input || "")
  if (!normalized || normalized === ".") return ""
  const trimmed = normalized.replace(/^\/+/, "")
  if (trimmed === ".." || trimmed.startsWith("../")) {
    throw new Error("invalid preview path")
  }
  return trimmed
}

function containerFilePath(relativePath: string) {
  const safeRelative = normalizeRelativePath(relativePath)
  if (!safeRelative) {
    throw new Error("preview path is required")
  }
  return path.posix.join(CONTAINER_WORKDIR, safeRelative)
}

function inferMimeType(filepath: string) {
  const ext = path.extname(filepath).toLowerCase()
  switch (ext) {
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".gif":
      return "image/gif"
    case ".webp":
      return "image/webp"
    case ".svg":
      return "image/svg+xml"
    case ".bmp":
      return "image/bmp"
    case ".ico":
      return "image/x-icon"
    case ".avif":
      return "image/avif"
    case ".pdf":
      return "application/pdf"
    default:
      return "application/octet-stream"
  }
}

async function ensureContainerRunning() {
  try {
    const { stdout } = await execFileAsync("docker", [
      "inspect",
      "-f",
      "{{.State.Running}}",
      CONTAINER_NAME,
    ])
    return stdout.trim() === "true"
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const running = await ensureContainerRunning()
  if (!running) {
    return NextResponse.json(
      { error: "agent sandbox is not running" },
      { status: 503 },
    )
  }

  const relativePath = req.nextUrl.searchParams.get("path") || ""

  try {
    const sourcePath = containerFilePath(relativePath)
    const tempDir = await mkdtemp(path.join(tmpdir(), "opencode-preview-"))
    const tempFile = path.join(tempDir, path.basename(relativePath || "preview.bin"))

    try {
      await execFileAsync("docker", ["cp", `${CONTAINER_NAME}:${sourcePath}`, tempFile])
      const bytes = await readFile(tempFile)
      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": inferMimeType(relativePath),
          "Cache-Control": "no-store",
          "Content-Disposition": `inline; filename="${path.basename(relativePath)}"`,
        },
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "preview failed"
    const status =
      message === "invalid preview path" || message === "preview path is required"
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
