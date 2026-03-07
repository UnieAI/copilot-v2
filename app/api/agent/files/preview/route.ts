import { execFile } from "child_process"
import { mkdtemp, readFile, rm } from "fs/promises"
import { tmpdir } from "os"
import path from "path"
import { promisify } from "util"
import { NextRequest, NextResponse } from "next/server"
import { getUserAgentRuntime, requireAgentUserId } from "@/lib/agent/runtime"
import { toReadableSandboxAbsolutePath } from "@/lib/agent/workspace-guard"

export const runtime = "nodejs"

const execFileAsync = promisify(execFile)

function containerFilePath(relativePath: string, workdir: string, homeDir: string) {
  return toReadableSandboxAbsolutePath(relativePath, [workdir, homeDir, "/tmp"], {
    allowEmpty: false,
    label: "preview path",
  })
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

async function ensureContainerRunning(containerName: string) {
  try {
    const { stdout } = await execFileAsync("docker", [
      "inspect",
      "-f",
      "{{.State.Running}}",
      containerName,
    ])
    return stdout.trim() === "true"
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await requireAgentUserId()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const agentRuntime = await getUserAgentRuntime(userId)
  const running = await ensureContainerRunning(agentRuntime.containerName)
  if (!running) {
    return NextResponse.json(
      { error: "agent sandbox is not running" },
      { status: 503 },
    )
  }

  const relativePath = req.nextUrl.searchParams.get("path") || ""
  const shouldDownload = req.nextUrl.searchParams.get("download") === "1"

  try {
    const sourcePath = containerFilePath(relativePath, agentRuntime.workdir, agentRuntime.homeDir)
    const tempDir = await mkdtemp(path.join(tmpdir(), "opencode-preview-"))
    const tempFile = path.join(tempDir, path.basename(relativePath || "preview.bin"))

    try {
      await execFileAsync("docker", ["cp", `${agentRuntime.containerName}:${sourcePath}`, tempFile])
      const bytes = await readFile(tempFile)
      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": inferMimeType(relativePath),
          "Cache-Control": "no-store",
          "Content-Disposition": `${shouldDownload ? "attachment" : "inline"}; filename="${path.basename(relativePath)}"`,
        },
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "preview failed"
    const status =
      message === "invalid preview path"
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
