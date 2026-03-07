import { randomUUID } from "crypto"
import { execFile } from "child_process"
import { mkdir, rm, writeFile } from "fs/promises"
import path from "path"
import { promisify } from "util"
import { NextRequest, NextResponse } from "next/server"
import { getUserAgentRuntime, requireAgentUserId } from "@/lib/agent/runtime"
import { toWorkspaceAbsolutePath, toWorkspaceRelativePath } from "@/lib/agent/workspace-guard"

export const runtime = "nodejs"

const execFileAsync = promisify(execFile)

function containerTargetPath(relativePath: string, workdir: string) {
  return toWorkspaceAbsolutePath(relativePath, workdir, {
    allowEmpty: true,
    label: "upload path",
  })
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

export async function POST(req: NextRequest) {
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
    const destinationDir = containerTargetPath(targetPath, agentRuntime.workdir)
    await execFileAsync("docker", ["exec", agentRuntime.containerName, "mkdir", "-p", destinationDir])

    const uploaded: Array<{ name: string; path: string; size: number }> = []

    for (const file of files) {
      const safeName = path.posix.basename(file.name).replace(/[\\/:*?"<>|]+/g, "_") || "upload.bin"
      const tempFile = path.join(tempDir, safeName)
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(tempFile, buffer)

      const containerFilePath = path.posix.join(destinationDir, safeName)
      await execFileAsync("docker", ["cp", tempFile, `${agentRuntime.containerName}:${containerFilePath}`])

      uploaded.push({
        name: safeName,
        path: toWorkspaceRelativePath(joinRelativePath(targetPath, safeName), agentRuntime.workdir, {
          allowEmpty: false,
          label: "upload path",
        }),
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
  const base = path.posix.normalize(parent || "").replace(/^\/+/, "").replace(/^\.$/, "")
  return base ? `${base}/${child}` : child
}
