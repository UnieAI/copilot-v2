import { randomUUID } from "crypto"
import { execFile } from "child_process"
import { mkdir, rm, writeFile } from "fs/promises"
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
    throw new Error("invalid upload path")
  }
  return trimmed
}

function containerTargetPath(relativePath: string) {
  const safeRelative = normalizeRelativePath(relativePath)
  return safeRelative
    ? path.posix.join(CONTAINER_WORKDIR, safeRelative)
    : CONTAINER_WORKDIR
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

export async function POST(req: NextRequest) {
  const running = await ensureContainerRunning()
  if (!running) {
    return NextResponse.json(
      { error: "agent sandbox is not running" },
      { status: 503 },
    )
  }

  const formData = await req.formData()
  const targetPath = String(formData.get("path") || "")
  const files = formData
    .getAll("files")
    .filter((item): item is File => item instanceof File && item.size > 0)

  if (files.length === 0) {
    return NextResponse.json({ error: "no files uploaded" }, { status: 400 })
  }

  const tempDir = path.join("/tmp", `opencode-upload-${randomUUID()}`)
  await mkdir(tempDir, { recursive: true })

  try {
    const destinationDir = containerTargetPath(targetPath)
    await execFileAsync("docker", ["exec", CONTAINER_NAME, "mkdir", "-p", destinationDir])

    const uploaded: Array<{ name: string; path: string; size: number }> = []

    for (const file of files) {
      const safeName = path.posix.basename(file.name).replace(/[\\/:*?"<>|]+/g, "_") || "upload.bin"
      const tempFile = path.join(tempDir, safeName)
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(tempFile, buffer)

      const containerFilePath = path.posix.join(destinationDir, safeName)
      await execFileAsync("docker", ["cp", tempFile, `${CONTAINER_NAME}:${containerFilePath}`])

      uploaded.push({
        name: safeName,
        path: normalizeRelativePath(joinRelativePath(targetPath, safeName)),
        size: file.size,
      })
    }

    return NextResponse.json({ uploaded })
  } catch (error) {
    const message = error instanceof Error ? error.message : "upload failed"
    const status = message === "invalid upload path" ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

function joinRelativePath(parent: string, child: string) {
  const base = normalizeRelativePath(parent)
  return base ? `${base}/${child}` : child
}
