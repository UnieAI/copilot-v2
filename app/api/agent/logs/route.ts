import { execFile } from "child_process"
import { promisify } from "util"
import { NextResponse } from "next/server"
import { getUserAgentRuntime, requireAgentUserId } from "@/lib/agent/runtime"

const execFileAsync = promisify(execFile)
export const runtime = "nodejs"

export async function GET() {
    let userId: string
    try {
        userId = await requireAgentUserId()
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const agentRuntime = await getUserAgentRuntime(userId)
    try {
        const { stdout, stderr } = await execFileAsync("docker", [
            "logs",
            "--tail",
            "100",
            agentRuntime.containerName,
        ])
        return NextResponse.json({ logs: `${stdout}${stderr}` })
    } catch (error: any) {
        const logs = `${error?.stdout || ""}${error?.stderr || ""}`
        return NextResponse.json({ logs })
    }
}
