import "server-only"

import { homedir } from "os"
import { join } from "path"
import { readFileSync, existsSync } from "fs"
import { execSync } from "child_process"

const CONFIG_PATH = join(homedir(), ".portal.json")

type InstanceType = "process" | "docker"

export interface PortalInstance {
  id: string
  name: string
  directory: string
  port: number | null
  opencodePort: number
  hostname: string
  opencodePid: number | null
  webPid: number | null
  startedAt: string
  instanceType: InstanceType
  containerId: string | null
}

export interface RunningInstance extends PortalInstance {
  state: "running"
  status: string
}

interface PortalConfig {
  instances: PortalInstance[]
}

function readConfig(): PortalConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const content = readFileSync(CONFIG_PATH, "utf-8")
      const config = JSON.parse(content)
      const instances = Array.isArray(config.instances) ? config.instances : []
      return {
        instances: instances.map((instance: PortalInstance) => ({
          ...instance,
          instanceType: instance.instanceType || "process",
          containerId: instance.containerId || null,
          opencodePid: instance.opencodePid ?? null,
          webPid: instance.webPid ?? null,
        })),
      }
    }
  } catch (error) {
    console.warn(
      "[instances] Failed to read portal config:",
      error instanceof Error ? error.message : error
    )
  }
  return { instances: [] }
}

function isProcessRunning(pid: number | null): boolean {
  if (pid === null) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function isContainerRunning(containerId: string | null): boolean {
  if (!containerId) return false
  try {
    const result = execSync(
      `docker inspect --format="{{.State.Running}}" ${containerId}`,
      { timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }
    )
    return result.toString().trim() === "true"
  } catch {
    return false
  }
}

export function getRunningInstances(): RunningInstance[] {
  const config = readConfig()

  return config.instances
    .map((instance) => {
      let opencodeRunning = false
      if (instance.instanceType === "docker") {
        opencodeRunning = isContainerRunning(instance.containerId)
      } else {
        opencodeRunning = isProcessRunning(instance.opencodePid)
      }

      if (!opencodeRunning) return null

      return {
        ...instance,
        state: "running" as const,
        status: `Running since ${new Date(instance.startedAt).toLocaleString()}`,
      }
    })
    .filter((instance): instance is RunningInstance => instance !== null)
}
