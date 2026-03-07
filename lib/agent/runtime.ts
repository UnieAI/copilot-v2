import "server-only"

import { createHash } from "crypto"
import net from "net"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import {
  type AdminSettings,
  type UserAgentSetting,
  type UserAgentSkill,
  adminSettings,
  userAgentSettings,
  userAgentSkills,
} from "@/lib/db/schema"
import {
  type AgentOpencodeConfig,
  type AgentRemoteMcpServer,
  type AgentRemoteMcpServerConfig,
} from "@/lib/agent/mcp-config"
import type { AgentSkillDefinition } from "@/lib/agent/skill-config"
import { and, eq } from "drizzle-orm"

const IMAGE_NAME = process.env.OPENCODE_CONTAINER_IMAGE || "opencode-agent:latest"
const CONTAINER_WORKDIR = "/workspace"
const CONTAINER_HOME = "/home/opencode"
const SANDBOX_BIND_ADDRESS = "127.0.0.1"
const SANDBOX_NETWORK_NAME = "copilot-agent-sandbox"
const SANDBOX_USERNAME = process.env.OPENCODE_SANDBOX_USERNAME || "opencode"
const SANDBOX_PASSWORD = process.env.OPENCODE_SANDBOX_PASSWORD || ""
const FALLBACK_PORT_RANGE_START = Number(process.env.OPENCODE_PORT_RANGE_START || 14108)
const FALLBACK_PORT_RANGE_END = Number(process.env.OPENCODE_PORT_RANGE_END || 18108)
const OPENCODE_CONFIG_SCHEMA_URL = "https://opencode.ai/config.json"

const HARD_DEFAULTS = {
  workspacePersistence: true,
  memoryMb: 2048,
  cpuMillicores: 1000,
  pidLimit: 256,
  idleTimeoutMinutes: 30,
} as const

const CLAMP = {
  memoryMb: { min: 512, max: 8192 },
  cpuMillicores: { min: 250, max: 4000 },
  pidLimit: { min: 64, max: 1024 },
  idleTimeoutMinutes: { min: 5, max: 240 },
} as const

export type AgentSettingsInput = {
  workspacePersistence: boolean
  memoryMb: number
  cpuMillicores: number
  pidLimit: number
  idleTimeoutMinutes: number
}

export type AgentSettingsOverrides = {
  workspacePersistence: boolean | null
  memoryMb: number | null
  cpuMillicores: number | null
  pidLimit: number | null
  idleTimeoutMinutes: number | null
}

export type ResolvedAgentSettings = AgentSettingsInput & {
  assignedPort: number
}

export type AgentPlatformPolicy = {
  defaults: AgentSettingsInput
  portRange: {
    start: number
    end: number
  }
}

export type UserAgentSettingsState = {
  useCustomSettings: boolean
  defaults: AgentSettingsInput
  overrides: AgentSettingsOverrides
  effective: ResolvedAgentSettings
}

export type UserAgentRuntime = {
  userId: string
  baseUrl: string
  workdir: string
  homeDir: string
  imageName: string
  containerName: string
  workspaceVolume: string | null
  homeVolume: string | null
  hostPort: number
  bindAddress: string
  networkName: string
  portRange: {
    start: number
    end: number
  }
  limits: {
    memoryMb: number
    memory: string
    cpuMillicores: number
    cpus: string
    pids: number
  }
  idleTimeoutMinutes: number
  workspacePersistence: boolean
  readOnlyRootfs: boolean
  auth: {
    username: string
    password: string
  }
  opencodeConfigContent: string
  mcpServerCount: number
}

export type AgentSettingsUpdateInput = {
  useCustomSettings: boolean
} & AgentSettingsInput

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function shortUserHash(userId: string) {
  return createHash("sha256").update(userId).digest("hex").slice(0, 12)
}

function toCpuValue(millicores: number) {
  const value = millicores / 1000
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")
}

async function isPortFree(port: number) {
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer()
    server.once("error", reject)
    server.once("listening", () => {
      server.close((closeError) => {
        if (closeError) reject(closeError)
        else resolve()
      })
    })
    server.listen(port, "127.0.0.1")
  })
}

function sanitizeBaseSettings(input?: Partial<AgentSettingsInput> | null): AgentSettingsInput {
  return {
    workspacePersistence:
      typeof input?.workspacePersistence === "boolean"
        ? input.workspacePersistence
        : HARD_DEFAULTS.workspacePersistence,
    memoryMb: clampNumber(
      Number(input?.memoryMb ?? HARD_DEFAULTS.memoryMb),
      CLAMP.memoryMb.min,
      CLAMP.memoryMb.max,
    ),
    cpuMillicores: clampNumber(
      Number(input?.cpuMillicores ?? HARD_DEFAULTS.cpuMillicores),
      CLAMP.cpuMillicores.min,
      CLAMP.cpuMillicores.max,
    ),
    pidLimit: clampNumber(
      Number(input?.pidLimit ?? HARD_DEFAULTS.pidLimit),
      CLAMP.pidLimit.min,
      CLAMP.pidLimit.max,
    ),
    idleTimeoutMinutes: clampNumber(
      Number(input?.idleTimeoutMinutes ?? HARD_DEFAULTS.idleTimeoutMinutes),
      CLAMP.idleTimeoutMinutes.min,
      CLAMP.idleTimeoutMinutes.max,
    ),
  }
}

function sanitizeOverrides(input?: Partial<UserAgentSetting> | null): AgentSettingsOverrides {
  return {
    workspacePersistence:
      typeof input?.workspacePersistence === "boolean" ? input.workspacePersistence : null,
    memoryMb:
      typeof input?.memoryMb === "number"
        ? clampNumber(input.memoryMb, CLAMP.memoryMb.min, CLAMP.memoryMb.max)
        : null,
    cpuMillicores:
      typeof input?.cpuMillicores === "number"
        ? clampNumber(input.cpuMillicores, CLAMP.cpuMillicores.min, CLAMP.cpuMillicores.max)
        : null,
    pidLimit:
      typeof input?.pidLimit === "number"
        ? clampNumber(input.pidLimit, CLAMP.pidLimit.min, CLAMP.pidLimit.max)
        : null,
    idleTimeoutMinutes:
      typeof input?.idleTimeoutMinutes === "number"
        ? clampNumber(input.idleTimeoutMinutes, CLAMP.idleTimeoutMinutes.min, CLAMP.idleTimeoutMinutes.max)
        : null,
  }
}

function sanitizeHeaderMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined

  const headers: Record<string, string> = {}
  for (const [key, rawValue] of Object.entries(value)) {
    const safeKey = key.trim()
    const safeValue = typeof rawValue === "string" ? rawValue.trim() : ""
    if (!safeKey || !safeValue) continue
    headers[safeKey] = safeValue
  }

  return Object.keys(headers).length > 0 ? headers : undefined
}

function sanitizeRemoteMcpServerConfig(value: unknown): AgentRemoteMcpServerConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null

  const input = value as Record<string, unknown>
  if (input.type !== "remote") return null

  const url = typeof input.url === "string" ? input.url.trim() : ""
  if (!url) return null

  const config: AgentRemoteMcpServerConfig = {
    type: "remote",
    url,
  }

  if (typeof input.enabled === "boolean") {
    config.enabled = input.enabled
  }

  const headers = sanitizeHeaderMap(input.headers)
  if (headers) {
    config.headers = headers
  }

  if (typeof input.timeout === "number" && Number.isFinite(input.timeout)) {
    config.timeout = clampNumber(input.timeout, 1000, 300000)
  }

  if (input.oauth === false) {
    config.oauth = false
  }

  return config
}

function sanitizeStoredAgentMcpConfig(input: unknown): AgentOpencodeConfig {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {}
  const mcpSource =
    source.mcp && typeof source.mcp === "object" && !Array.isArray(source.mcp)
      ? (source.mcp as Record<string, unknown>)
      : {}

  const mcp: Record<string, AgentRemoteMcpServerConfig> = {}
  for (const [rawId, rawConfig] of Object.entries(mcpSource)) {
    const id = rawId.trim()
    if (!id) continue
    const config = sanitizeRemoteMcpServerConfig(rawConfig)
    if (!config) continue
    mcp[id] = config
  }

  return {
    $schema: OPENCODE_CONFIG_SCHEMA_URL,
    mcp,
  }
}

function isRecoverableAgentConfigError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ""

  const normalized = message.toLowerCase()
  return (
    normalized.includes("user_agent_skills") ||
    normalized.includes("user_agent_settings") ||
    normalized.includes("mcp_config") ||
    normalized.includes("column") ||
    normalized.includes("relation") ||
    normalized.includes("does not exist") ||
    normalized.includes("no such table")
  )
}

function sanitizeAgentSkillName(input: string) {
  const value = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  if (!value) {
    throw new Error("Skill name is required")
  }

  return value
}

function sanitizeAgentSkillContent(input: string) {
  return String(input || "").trim()
}

function normalizeAgentSkillRow(row: UserAgentSkill): AgentSkillDefinition {
  return {
    id: row.id,
    name: sanitizeAgentSkillName(row.name),
    description: String(row.description || "").trim(),
    content: sanitizeAgentSkillContent(row.content),
    isEnabled: row.isEnabled === 1,
  }
}

function renderAgentSkillMarkdown(skill: AgentSkillDefinition) {
  const lines = [
    "---",
    `name: ${skill.name}`,
    `description: ${JSON.stringify(skill.description || "")}`,
    "---",
    "",
    skill.content || `# ${skill.name}\n`,
  ]

  return `${lines.join("\n").trimEnd()}\n`
}

function listAgentRemoteMcpServers(config: AgentOpencodeConfig): AgentRemoteMcpServer[] {
  return Object.entries(config.mcp)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, serverConfig]) => ({
      id,
      config: serverConfig,
    }))
}

async function getStoredAgentMcpConfig(userId: string): Promise<AgentOpencodeConfig> {
  try {
    const row = await db.query.userAgentSettings.findFirst({
      where: eq(userAgentSettings.userId, userId),
      columns: { mcpConfig: true },
    })

    return sanitizeStoredAgentMcpConfig(row?.mcpConfig)
  } catch (error) {
    if (isRecoverableAgentConfigError(error)) {
      return sanitizeStoredAgentMcpConfig(null)
    }
    throw error
  }
}

async function saveStoredAgentMcpConfig(userId: string, config: AgentOpencodeConfig) {
  await db
    .insert(userAgentSettings)
    .values({
      userId,
      mcpConfig: config,
    })
    .onConflictDoUpdate({
      target: userAgentSettings.userId,
      set: {
        mcpConfig: config,
        updatedAt: new Date(),
      },
    })
}

async function getUserAgentSkillByName(userId: string, name: string) {
  return db.query.userAgentSkills.findFirst({
    where: and(eq(userAgentSkills.userId, userId), eq(userAgentSkills.name, name)),
  })
}

function overridesToInsert(overrides: AgentSettingsOverrides) {
  return {
    workspacePersistence: overrides.workspacePersistence,
    memoryMb: overrides.memoryMb,
    cpuMillicores: overrides.cpuMillicores,
    pidLimit: overrides.pidLimit,
    idleTimeoutMinutes: overrides.idleTimeoutMinutes,
  }
}

function resolveEffectiveSettings(
  defaults: AgentSettingsInput,
  overrides: AgentSettingsOverrides,
  assignedPort: number,
): ResolvedAgentSettings {
  return {
    workspacePersistence: overrides.workspacePersistence ?? defaults.workspacePersistence,
    memoryMb: overrides.memoryMb ?? defaults.memoryMb,
    cpuMillicores: overrides.cpuMillicores ?? defaults.cpuMillicores,
    pidLimit: overrides.pidLimit ?? defaults.pidLimit,
    idleTimeoutMinutes: overrides.idleTimeoutMinutes ?? defaults.idleTimeoutMinutes,
    assignedPort,
  }
}

function hasAnyOverride(overrides: AgentSettingsOverrides) {
  return Object.values(overrides).some((value) => value !== null)
}

function normalizePortRange(start?: number | null, end?: number | null) {
  const safeStart = clampNumber(Number(start ?? FALLBACK_PORT_RANGE_START), 1025, 65534)
  const minEnd = Math.min(65535, safeStart + 10)
  const safeEnd = clampNumber(Number(end ?? FALLBACK_PORT_RANGE_END), minEnd, 65535)
  return { start: safeStart, end: safeEnd }
}

async function reserveAssignedPort(
  userId: string,
  range: { start: number; end: number },
  currentPort?: number | null,
) {
  if (currentPort && currentPort >= range.start && currentPort <= range.end) {
    return currentPort
  }

  const rangeSize = range.end - range.start + 1
  if (rangeSize <= 0) {
    throw new Error("Invalid agent sandbox port range")
  }

  const seed = parseInt(shortUserHash(userId).slice(0, 8), 16)
  for (let offset = 0; offset < rangeSize; offset += 1) {
    const candidate = range.start + ((seed + offset) % rangeSize)
    const taken = await db.query.userAgentSettings.findFirst({
      where: eq(userAgentSettings.assignedPort, candidate),
      columns: { userId: true },
    })
    if (taken && taken.userId !== userId) continue

    try {
      await isPortFree(candidate)
    } catch {
      continue
    }

    try {
      const [updated] = await db
        .insert(userAgentSettings)
        .values({
          userId,
          assignedPort: candidate,
        })
        .onConflictDoUpdate({
          target: userAgentSettings.userId,
          set: {
            assignedPort: candidate,
            updatedAt: new Date(),
          },
        })
        .returning({ assignedPort: userAgentSettings.assignedPort })

      if (updated?.assignedPort === candidate) {
        return candidate
      }
    } catch {
      continue
    }
  }

  throw new Error("No available agent sandbox ports")
}

export function normalizeAgentSettingsInput(input: Partial<AgentSettingsInput>) {
  return sanitizeBaseSettings(input)
}

export function normalizeAdminAgentDefaults(input: Partial<AdminSettings>) {
  return {
    defaults: sanitizeBaseSettings({
      workspacePersistence: input.agentDefaultWorkspacePersistence,
      memoryMb: input.agentDefaultMemoryMb,
      cpuMillicores: input.agentDefaultCpuMillicores,
      pidLimit: input.agentDefaultPidLimit,
      idleTimeoutMinutes: input.agentDefaultIdleTimeoutMinutes,
    }),
    portRange: normalizePortRange(input.agentPortRangeStart, input.agentPortRangeEnd),
  }
}

export async function getAgentPlatformPolicy(): Promise<AgentPlatformPolicy> {
  const settings = await db.query.adminSettings.findFirst()
  return normalizeAdminAgentDefaults(settings || {})
}

export async function getAgentPlatformDefaults(): Promise<AgentSettingsInput> {
  const policy = await getAgentPlatformPolicy()
  return policy.defaults
}

export async function getUserAgentSettingsState(userId: string): Promise<UserAgentSettingsState> {
  const [row, policy] = await Promise.all([
    db.query.userAgentSettings.findFirst({
      where: eq(userAgentSettings.userId, userId),
    }),
    getAgentPlatformPolicy(),
  ])

  const assignedPort = await reserveAssignedPort(userId, policy.portRange, row?.assignedPort)
  const overrides = sanitizeOverrides(row)
  const effective = resolveEffectiveSettings(policy.defaults, overrides, assignedPort)

  if (!row || row.assignedPort !== assignedPort) {
    await db
      .insert(userAgentSettings)
      .values({
        userId,
        assignedPort,
        ...(!row ? overridesToInsert(overrides) : {}),
      })
      .onConflictDoUpdate({
        target: userAgentSettings.userId,
        set: {
          assignedPort,
          updatedAt: new Date(),
        },
      })
  }

  return {
    useCustomSettings: hasAnyOverride(overrides),
    defaults: policy.defaults,
    overrides,
    effective,
  }
}

export async function getUserAgentSettings(userId: string) {
  const state = await getUserAgentSettingsState(userId)
  return state.effective
}

export async function updateUserAgentSettings(userId: string, input: AgentSettingsUpdateInput) {
  const [current, policy] = await Promise.all([
    db.query.userAgentSettings.findFirst({
      where: eq(userAgentSettings.userId, userId),
      columns: { assignedPort: true },
    }),
    getAgentPlatformPolicy(),
  ])
  const assignedPort = await reserveAssignedPort(userId, policy.portRange, current?.assignedPort)
  const normalized = sanitizeBaseSettings(input)
  const overrides = input.useCustomSettings
    ? ({
        workspacePersistence: normalized.workspacePersistence,
        memoryMb: normalized.memoryMb,
        cpuMillicores: normalized.cpuMillicores,
        pidLimit: normalized.pidLimit,
        idleTimeoutMinutes: normalized.idleTimeoutMinutes,
      } satisfies AgentSettingsOverrides)
    : ({
        workspacePersistence: null,
        memoryMb: null,
        cpuMillicores: null,
        pidLimit: null,
        idleTimeoutMinutes: null,
      } satisfies AgentSettingsOverrides)

  await db
    .insert(userAgentSettings)
    .values({
      userId,
      assignedPort,
      ...overridesToInsert(overrides),
    })
    .onConflictDoUpdate({
      target: userAgentSettings.userId,
      set: {
        assignedPort,
        ...overridesToInsert(overrides),
        updatedAt: new Date(),
      },
    })

  return {
    useCustomSettings: input.useCustomSettings,
    defaults: policy.defaults,
    overrides,
    effective: resolveEffectiveSettings(policy.defaults, overrides, assignedPort),
  } satisfies UserAgentSettingsState
}

export async function getUserAgentMcpServers(userId: string) {
  const config = await getStoredAgentMcpConfig(userId)
  return listAgentRemoteMcpServers(config)
}

export async function upsertUserAgentMcpServer(userId: string, server: AgentRemoteMcpServer) {
  const current = await getStoredAgentMcpConfig(userId)
  const config = sanitizeRemoteMcpServerConfig(server.config)
  if (!config) {
    throw new Error("Invalid remote MCP config")
  }
  current.mcp[server.id] = config
  await saveStoredAgentMcpConfig(userId, current)
  return listAgentRemoteMcpServers(current)
}

export async function replaceUserAgentMcpServer(
  userId: string,
  previousId: string,
  server: AgentRemoteMcpServer,
) {
  const current = await getStoredAgentMcpConfig(userId)
  const config = sanitizeRemoteMcpServerConfig(server.config)
  if (!config) {
    throw new Error("Invalid remote MCP config")
  }
  if (previousId !== server.id) {
    delete current.mcp[previousId]
  }
  current.mcp[server.id] = config
  await saveStoredAgentMcpConfig(userId, current)
  return listAgentRemoteMcpServers(current)
}

export async function deleteUserAgentMcpServer(userId: string, serverId: string) {
  const current = await getStoredAgentMcpConfig(userId)
  delete current.mcp[serverId]
  await saveStoredAgentMcpConfig(userId, current)
  return listAgentRemoteMcpServers(current)
}

export async function toggleUserAgentMcpServer(userId: string, serverId: string, enabled: boolean) {
  const current = await getStoredAgentMcpConfig(userId)
  const existing = current.mcp[serverId]
  if (!existing) {
    throw new Error("MCP server not found")
  }
  current.mcp[serverId] = {
    ...existing,
    enabled,
  }
  await saveStoredAgentMcpConfig(userId, current)
  return listAgentRemoteMcpServers(current)
}

export async function getUserAgentSkills(userId: string) {
  try {
    const rows = await db.query.userAgentSkills.findMany({
      where: eq(userAgentSkills.userId, userId),
    })

    return rows
      .map(normalizeAgentSkillRow)
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    if (isRecoverableAgentConfigError(error)) {
      return []
    }
    throw error
  }
}

export async function getEnabledUserAgentSkills(userId: string) {
  const skills = await getUserAgentSkills(userId)
  return skills.filter((skill) => skill.isEnabled)
}

export async function createUserAgentSkill(
  userId: string,
  input: Omit<AgentSkillDefinition, "id">,
) {
  const name = sanitizeAgentSkillName(input.name)
  const exists = await getUserAgentSkillByName(userId, name)
  if (exists) {
    throw new Error("Skill name already exists")
  }

  const [created] = await db
    .insert(userAgentSkills)
    .values({
      userId,
      name,
      description: String(input.description || "").trim(),
      content: sanitizeAgentSkillContent(input.content),
      isEnabled: input.isEnabled ? 1 : 0,
    })
    .returning()

  return normalizeAgentSkillRow(created)
}

export async function updateUserAgentSkill(
  userId: string,
  skillId: string,
  input: Omit<AgentSkillDefinition, "id">,
) {
  const current = await db.query.userAgentSkills.findFirst({
    where: and(eq(userAgentSkills.userId, userId), eq(userAgentSkills.id, skillId)),
  })
  if (!current) {
    throw new Error("Skill not found")
  }

  const name = sanitizeAgentSkillName(input.name)
  if (name !== current.name) {
    const exists = await getUserAgentSkillByName(userId, name)
    if (exists && exists.id !== skillId) {
      throw new Error("Skill name already exists")
    }
  }

  const [updated] = await db
    .update(userAgentSkills)
    .set({
      name,
      description: String(input.description || "").trim(),
      content: sanitizeAgentSkillContent(input.content),
      isEnabled: input.isEnabled ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(and(eq(userAgentSkills.userId, userId), eq(userAgentSkills.id, skillId)))
    .returning()

  return normalizeAgentSkillRow(updated)
}

export async function deleteUserAgentSkill(userId: string, skillId: string) {
  const [deleted] = await db
    .delete(userAgentSkills)
    .where(and(eq(userAgentSkills.userId, userId), eq(userAgentSkills.id, skillId)))
    .returning()

  if (!deleted) {
    throw new Error("Skill not found")
  }
}

export async function toggleUserAgentSkill(userId: string, skillId: string, isEnabled: boolean) {
  const [updated] = await db
    .update(userAgentSkills)
    .set({
      isEnabled: isEnabled ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(and(eq(userAgentSkills.userId, userId), eq(userAgentSkills.id, skillId)))
    .returning()

  if (!updated) {
    throw new Error("Skill not found")
  }

  return normalizeAgentSkillRow(updated)
}

export async function getUserAgentSkillFiles(userId: string) {
  const skills = await getEnabledUserAgentSkills(userId)
  return skills.map((skill) => ({
    name: skill.name,
    content: renderAgentSkillMarkdown(skill),
  }))
}

export async function getUserAgentRuntime(userId: string): Promise<UserAgentRuntime> {
  const [state, policy, mcpConfig] = await Promise.all([
    getUserAgentSettingsState(userId),
    getAgentPlatformPolicy(),
    getStoredAgentMcpConfig(userId),
  ])
  const settings = state.effective
  const hash = shortUserHash(userId)
  const containerName = `opencode-agent-${hash}`
  const workspaceVolume = settings.workspacePersistence
    ? `opencode-agent-workspace-${hash}`
    : null
  const homeVolume = settings.workspacePersistence
    ? `opencode-agent-home-${hash}`
    : null

  return {
    userId,
    baseUrl: "http://127.0.0.1:4096",
    workdir: CONTAINER_WORKDIR,
    homeDir: CONTAINER_HOME,
    imageName: IMAGE_NAME,
    containerName,
    workspaceVolume,
    homeVolume,
    hostPort: settings.assignedPort,
    bindAddress: SANDBOX_BIND_ADDRESS,
    networkName: SANDBOX_NETWORK_NAME,
    portRange: policy.portRange,
    limits: {
      memoryMb: settings.memoryMb,
      memory: `${settings.memoryMb}m`,
      cpuMillicores: settings.cpuMillicores,
      cpus: toCpuValue(settings.cpuMillicores),
      pids: settings.pidLimit,
    },
    idleTimeoutMinutes: settings.idleTimeoutMinutes,
    workspacePersistence: settings.workspacePersistence,
    readOnlyRootfs: true,
    auth: {
      username: SANDBOX_USERNAME,
      password: SANDBOX_PASSWORD,
    },
    opencodeConfigContent: JSON.stringify(mcpConfig),
    mcpServerCount: Object.keys(mcpConfig.mcp).length,
  }
}

export async function requireAgentUserId() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    throw new Error("Unauthorized")
  }
  return userId as string
}
