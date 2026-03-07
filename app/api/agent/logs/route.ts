import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)
const CONTAINER_NAME = process.env.OPENCODE_CONTAINER_NAME || "opencode-agent"

export async function GET() {
    try {
        const { stdout } = await execAsync(
            `docker logs --tail 100 ${CONTAINER_NAME} 2>&1`
        )
        return NextResponse.json({ logs: stdout })
    } catch {
        return NextResponse.json({ logs: "" })
    }
}
