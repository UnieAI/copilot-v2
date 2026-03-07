import { execFile } from "child_process"
import { mkdtemp, mkdir, rm, writeFile } from "fs/promises"
import { tmpdir } from "os"
import path from "path"
import { promisify } from "util"
import { NextResponse } from "next/server"
import { getUserAgentRuntime, getUserAgentSkillFiles, requireAgentUserId } from "@/lib/agent/runtime"
import { opencodeFetch, readResponsePayload } from "@/lib/agent/opencode"

export const runtime = "nodejs"

const execFileAsync = promisify(execFile)

async function isContainerRunning(containerName: string): Promise<boolean> {
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

async function imageExists(imageName: string): Promise<boolean> {
  try {
    await execFileAsync("docker", ["image", "inspect", imageName])
    return true
  } catch {
    return false
  }
}

async function ensureNetwork(networkName: string) {
  try {
    await execFileAsync("docker", ["network", "inspect", networkName])
  } catch {
    await execFileAsync("docker", ["network", "create", "--driver", "bridge", networkName])
  }
}

async function buildImage(imageName: string) {
  const dockerfilePath = `${process.cwd()}/docker/opencode`
  await execFileAsync("docker", ["build", "-t", imageName, dockerfilePath])
}

async function startContainer(agentRuntime: Awaited<ReturnType<typeof getUserAgentRuntime>>) {
  try {
    await execFileAsync("docker", ["rm", "-f", agentRuntime.containerName])
  } catch {
    // Ignore stale container removal failure.
  }

  const args = [
    "run",
    "-d",
    "--init",
    "--name",
    agentRuntime.containerName,
    "--network",
    agentRuntime.networkName,
    "--label",
    "app=copilot-v2-agent",
    "--label",
    `user_id=${agentRuntime.userId}`,
    "-p",
    `${agentRuntime.bindAddress}:${agentRuntime.hostPort}:4096`,
    `--memory=${agentRuntime.limits.memory}`,
    `--cpus=${agentRuntime.limits.cpus}`,
    `--pids-limit=${agentRuntime.limits.pids}`,
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--tmpfs",
    "/tmp:rw,nosuid,nodev,size=64m",
    "--tmpfs",
    "/run:rw,nosuid,nodev,size=16m",
    "-e",
    `HOME=${agentRuntime.homeDir}`,
    "-e",
    `XDG_CONFIG_HOME=${agentRuntime.homeDir}/.config`,
    "-e",
    `XDG_CACHE_HOME=${agentRuntime.homeDir}/.cache`,
    "-e",
    `XDG_DATA_HOME=${agentRuntime.homeDir}/.local/share`,
    "-e",
    `OPENCODE_CONFIG_CONTENT=${agentRuntime.opencodeConfigContent}`,
  ]

  if (agentRuntime.workspaceVolume) {
    args.push(
      "--mount",
      `type=volume,src=${agentRuntime.workspaceVolume},dst=${agentRuntime.workdir}`,
      "--mount",
      `type=volume,src=${agentRuntime.homeVolume},dst=${agentRuntime.homeDir}`,
    )
  } else {
    args.push(
      "--tmpfs",
      `${agentRuntime.workdir}:rw,exec,nosuid,nodev,size=512m`,
      "--tmpfs",
      `${agentRuntime.homeDir}:rw,nosuid,nodev,size=128m`,
    )
  }

  args.push(agentRuntime.imageName)

  await execFileAsync("docker", args)
}

async function importAgentSkills(agentRuntime: Awaited<ReturnType<typeof getUserAgentRuntime>>) {
  const skills = await getUserAgentSkillFiles(agentRuntime.userId)
  const configRoot = path.posix.join(agentRuntime.homeDir, ".config", "opencode")
  const containerSkillRoot = path.posix.join(configRoot, "skills")

  await execFileAsync("docker", ["exec", agentRuntime.containerName, "mkdir", "-p", configRoot])
  await execFileAsync("docker", ["exec", agentRuntime.containerName, "rm", "-rf", containerSkillRoot])
  await execFileAsync("docker", ["exec", agentRuntime.containerName, "mkdir", "-p", containerSkillRoot])

  if (skills.length === 0) {
    return 0
  }

  const tempRoot = await mkdtemp(path.join(tmpdir(), "opencode-agent-skills-"))

  try {
    for (const skill of skills) {
      const localDir = path.join(tempRoot, skill.name)
      await mkdir(localDir, { recursive: true })
      await writeFile(path.join(localDir, "SKILL.md"), skill.content, "utf8")
    }

    await execFileAsync("docker", ["cp", `${tempRoot}/.`, `${agentRuntime.containerName}:${containerSkillRoot}`])
    return skills.length
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

async function stopContainer(containerName: string) {
  try {
    await execFileAsync("docker", ["rm", "-f", containerName])
  } catch {
    // ignore
  }
}

async function checkHealth(agentRuntime: Awaited<ReturnType<typeof getUserAgentRuntime>>): Promise<{ healthy: boolean; version?: string }> {
  try {
    const res = await opencodeFetch("/global/health", {
      runtime: agentRuntime,
    })
    if (res.ok) {
      const payload = await readResponsePayload(res)
      return (payload?.data ?? payload ?? {}) as { healthy: boolean; version?: string }
    }
  } catch {
    // no-op
  }
  return { healthy: false }
}

async function waitForHealth(agentRuntime: Awaited<ReturnType<typeof getUserAgentRuntime>>, maxRetries = 15, delayMs = 2000) {
  for (let index = 0; index < maxRetries; index += 1) {
    const health = await checkHealth(agentRuntime)
    if (health.healthy) return health
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return { healthy: false }
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export async function GET() {
  let userId: string
  try {
    userId = await requireAgentUserId()
  } catch {
    return unauthorizedResponse()
  }

  let agentRuntime: Awaited<ReturnType<typeof getUserAgentRuntime>>
  let skillCount = 0
  try {
    ;[agentRuntime, skillCount] = await Promise.all([
      getUserAgentRuntime(userId),
      getUserAgentSkillFiles(userId).then((skills) => skills.length),
    ])
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to resolve agent runtime", detail: error?.message || "Unknown error" },
      { status: 500 },
    )
  }

  const running = await isContainerRunning(agentRuntime.containerName)
  const config = {
    containerName: agentRuntime.containerName,
    imageName: agentRuntime.imageName,
    hostPort: agentRuntime.hostPort,
    workspaceVolume: agentRuntime.workspaceVolume,
    homeVolume: agentRuntime.homeVolume,
    workdir: agentRuntime.workdir,
    homeDir: agentRuntime.homeDir,
    bindAddress: agentRuntime.bindAddress,
    networkName: agentRuntime.networkName,
    workspacePersistence: agentRuntime.workspacePersistence,
    idleTimeoutMinutes: agentRuntime.idleTimeoutMinutes,
    readOnlyRootfs: agentRuntime.readOnlyRootfs,
    mcpServerCount: agentRuntime.mcpServerCount,
    skillCount,
    portRange: agentRuntime.portRange,
    limits: {
      memory: agentRuntime.limits.memory,
      memoryMb: agentRuntime.limits.memoryMb,
      cpus: agentRuntime.limits.cpus,
      cpuMillicores: agentRuntime.limits.cpuMillicores,
      pids: agentRuntime.limits.pids,
    },
  }

  if (!running) {
    return NextResponse.json({ status: "stopped", healthy: false, config })
  }

  const health = await checkHealth(agentRuntime)
  return NextResponse.json({ status: "running", ...health, config })
}

export async function POST() {
  let userId: string
  try {
    userId = await requireAgentUserId()
  } catch {
    return unauthorizedResponse()
  }

  let agentRuntime: Awaited<ReturnType<typeof getUserAgentRuntime>>
  try {
    agentRuntime = await getUserAgentRuntime(userId)
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to resolve agent runtime", detail: error?.message || "Unknown error" },
      { status: 500 },
    )
  }
  const running = await isContainerRunning(agentRuntime.containerName)
  if (running) {
    const health = await checkHealth(agentRuntime)
    if (health.healthy) {
      return NextResponse.json({ status: "already_running", ...health })
    }
  }

  const hasImage = await imageExists(agentRuntime.imageName)
  if (!hasImage) {
    try {
      await buildImage(agentRuntime.imageName)
    } catch (error: any) {
      return NextResponse.json(
        { error: "Failed to build opencode image", detail: error?.message || "Unknown error" },
        { status: 500 },
      )
    }
  }

  try {
    await ensureNetwork(agentRuntime.networkName)
    await startContainer(agentRuntime)
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to start opencode container", detail: error?.message || "Unknown error" },
      { status: 500 },
    )
  }

  const health = await waitForHealth(agentRuntime)
  if (!health.healthy) {
    return NextResponse.json(
      { status: "started_but_unhealthy", healthy: false },
      { status: 503 },
    )
  }

  try {
    await importAgentSkills(agentRuntime)
  } catch (error: any) {
    await stopContainer(agentRuntime.containerName)
    return NextResponse.json(
      { error: "Failed to import agent skills", detail: error?.message || "Unknown error" },
      { status: 500 },
    )
  }

  return NextResponse.json({ status: "started", ...health })
}

export async function DELETE() {
  let userId: string
  try {
    userId = await requireAgentUserId()
  } catch {
    return unauthorizedResponse()
  }

  let agentRuntime: Awaited<ReturnType<typeof getUserAgentRuntime>>
  try {
    agentRuntime = await getUserAgentRuntime(userId)
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to resolve agent runtime", detail: error?.message || "Unknown error" },
      { status: 500 },
    )
  }
  await stopContainer(agentRuntime.containerName)
  return NextResponse.json({ status: "stopped" })
}
