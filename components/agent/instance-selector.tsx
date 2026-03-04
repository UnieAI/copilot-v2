"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, Server } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useInstanceStore, type SelectedInstance } from "@/hooks/use-instance-store"
import { appendInstanceParams } from "@/lib/opencode/client-utils"

interface InstanceInfo {
  id: string
  name: string
  directory: string
  port: number
  hostname: string
  opencodePort: number
  instanceType: "process" | "docker"
  state: "running"
  status: string
}

const DEFAULT_VALUE = "__default__"

export function InstanceSelector() {
  const { instance, setInstance } = useInstanceStore()
  const [instances, setInstances] = useState<InstanceInfo[]>([])
  const [loading, setLoading] = useState(false)

  const fetchInstances = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(appendInstanceParams("/api/agent/instances", null), {
        cache: "no-store",
      })
      if (!res.ok) return
      const data = await res.json()
      const list: InstanceInfo[] = Array.isArray(data?.instances) ? data.instances : []
      setInstances(list)

      // Auto-clear selection if selected instance is no longer running
      if (instance) {
        const stillRunning = list.some(
          (i) => i.id === instance.id && (i.opencodePort || i.port) === instance.port
        )
        if (!stillRunning) {
          setInstance(null)
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setLoading(false)
    }
  }, [instance, setInstance])

  useEffect(() => {
    fetchInstances()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (value: string) => {
    if (value === DEFAULT_VALUE) {
      setInstance(null)
      return
    }
    const found = instances.find((i) => i.id === value)
    if (found) {
      setInstance({
        id: found.id,
        name: found.name,
        port: found.opencodePort || found.port,
        hostname: found.hostname || undefined,
      })
    }
  }

  const selectedValue = instance?.id || DEFAULT_VALUE
  const dirName = (dir: string) => {
    const parts = dir.split("/").filter(Boolean)
    return parts[parts.length - 1] || dir
  }

  return (
    <div className="flex items-center gap-1.5">
      <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Select value={selectedValue} onValueChange={handleChange}>
        <SelectTrigger className="h-7 w-auto min-w-[120px] max-w-[220px] text-xs border-border/60 bg-background/50">
          <SelectValue placeholder="Instance" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_VALUE}>
            <span className="text-xs">Default (env)</span>
          </SelectItem>
          {instances.map((inst) => (
            <SelectItem key={inst.id} value={inst.id}>
              <span className="flex items-center gap-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate">{dirName(inst.directory)}</span>
                <span className="text-muted-foreground">:{inst.opencodePort || inst.port}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={fetchInstances}
        disabled={loading}
        className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors disabled:opacity-50"
        title="Refresh instances"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  )
}
