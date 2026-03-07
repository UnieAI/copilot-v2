import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

const CONTAINER_NAME = process.env.OPENCODE_CONTAINER_NAME || "opencode-agent"
const IMAGE_NAME = process.env.OPENCODE_CONTAINER_IMAGE || "opencode-agent:latest"
const HOST_PORT = Number(process.env.OPENCODE_PORT || 4096)
const WORKSPACE_VOLUME = process.env.OPENCODE_SANDBOX_VOLUME || "opencode-agent-workspace"
const CONTAINER_WORKDIR = process.env.OPENCODE_CONTAINER_WORKDIR || "/workspace"
const MEMORY_LIMIT = process.env.OPENCODE_MEMORY_LIMIT || "512m"
const CPU_LIMIT = process.env.OPENCODE_CPU_LIMIT || "1"
const PID_LIMIT = Number(process.env.OPENCODE_PID_LIMIT || 256)
const HEALTH_URL = `http://localhost:${HOST_PORT}/global/health`

async function isContainerRunning(): Promise<boolean> {
    try {
        const { stdout } = await execAsync(
            `docker inspect -f '{{.State.Running}}' ${CONTAINER_NAME} 2>/dev/null`
        )
        return stdout.trim() === "true"
    } catch {
        return false
    }
}

async function imageExists(): Promise<boolean> {
    try {
        await execAsync(`docker image inspect ${IMAGE_NAME} 2>/dev/null`)
        return true
    } catch {
        return false
    }
}

async function buildImage(): Promise<void> {
    const dockerfilePath = `${process.cwd()}/docker/opencode`
    await execAsync(`docker build -t ${IMAGE_NAME} ${dockerfilePath}`)
}

async function startContainer(): Promise<void> {
    // Remove existing stopped container if any
    try {
        await execAsync(`docker rm -f ${CONTAINER_NAME} 2>/dev/null`)
    } catch { /* ignore */ }

    const dockerArgs = [
        "docker run -d",
        `--name ${CONTAINER_NAME}`,
        `-p ${HOST_PORT}:4096`,
        `--memory=${MEMORY_LIMIT}`,
        `--cpus=${CPU_LIMIT}`,
        `--pids-limit=${PID_LIMIT}`,
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        `--mount type=volume,src=${WORKSPACE_VOLUME},dst=${CONTAINER_WORKDIR}`,
        IMAGE_NAME,
    ]

    await execAsync(dockerArgs.join(" "))
}

async function stopContainer(): Promise<void> {
    try {
        await execAsync(`docker rm -f ${CONTAINER_NAME} 2>/dev/null`)
    } catch { /* ignore */ }
}

async function checkHealth(): Promise<{ healthy: boolean; version?: string }> {
    try {
        const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(3000) })
        if (res.ok) {
            return await res.json()
        }
        return { healthy: false }
    } catch {
        return { healthy: false }
    }
}

async function waitForHealth(maxRetries = 15, delayMs = 2000): Promise<{ healthy: boolean; version?: string }> {
    for (let i = 0; i < maxRetries; i++) {
        const health = await checkHealth()
        if (health.healthy) return health
        await new Promise(r => setTimeout(r, delayMs))
    }
    return { healthy: false }
}

// GET /api/agent — check health status
export async function GET() {
    const running = await isContainerRunning()
    const config = {
        containerName: CONTAINER_NAME,
        imageName: IMAGE_NAME,
        hostPort: HOST_PORT,
        workspaceVolume: WORKSPACE_VOLUME,
        workdir: CONTAINER_WORKDIR,
        limits: {
            memory: MEMORY_LIMIT,
            cpus: CPU_LIMIT,
            pids: PID_LIMIT,
        },
    }
    if (!running) {
        return NextResponse.json({ status: "stopped", healthy: false, config })
    }

    const health = await checkHealth()
    return NextResponse.json({ status: "running", ...health, config })
}

// POST /api/agent — start the agent sandbox
export async function POST() {
    const running = await isContainerRunning()
    if (running) {
        const health = await checkHealth()
        if (health.healthy) {
            return NextResponse.json({ status: "already_running", ...health })
        }
    }

    // Build image if it doesn't exist
    const hasImage = await imageExists()
    if (!hasImage) {
        try {
            await buildImage()
        } catch (e: any) {
            return NextResponse.json(
                { error: "Failed to build opencode image", detail: e.message },
                { status: 500 }
            )
        }
    }

    // Start container
    try {
        await startContainer()
    } catch (e: any) {
        return NextResponse.json(
            { error: "Failed to start opencode container", detail: e.message },
            { status: 500 }
        )
    }

    // Wait for health
    const health = await waitForHealth()
    if (!health.healthy) {
        return NextResponse.json(
            { status: "started_but_unhealthy", healthy: false },
            { status: 503 }
        )
    }

    return NextResponse.json({ status: "started", ...health })
}

// DELETE /api/agent — stop the agent sandbox
export async function DELETE() {
    await stopContainer()
    return NextResponse.json({ status: "stopped" })
}
