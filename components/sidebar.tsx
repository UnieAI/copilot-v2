"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { signOut } from "next-auth/react"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
    MessageSquare, Settings, Shield,
    Plus, Trash2, LogOut, Sun, Moon, Monitor,
    PanelLeftClose, Pencil, ChevronRight,
    MoreHorizontal, FolderInput, FolderOutput, Folder, FolderPlus,
    Users2, Loader2, ChevronUp, Bot
} from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { streamStore } from "@/lib/stream-store"
import { UnieAIIcon } from "@/components/sidebar/unieai-logo"
import { motion, AnimatePresence } from "framer-motion"
import {
    getOpencodeEventSnapshot,
    subscribeOpencodeEvents,
    subscribeOpencodeSnapshot,
} from "@/components/chat/chat-interface/agent/opencode-events"

import {
    Sidebar as ShadcnSidebar,
    SidebarContent,
    SidebarHeader,
    SidebarRail,
    useSidebar,
} from '@/components/ui/sidebar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import type { Session } from "next-auth"

type ChatSession = { id: string; title: string; updatedAt: string; projectId: string | null }
type ChatProject = { id: string; name: string; updatedAt: string }
type AgentSession = {
    id: string
    title?: string
    parentID?: string
    parentId?: string
    time?: { created?: number; updated?: number }
}
type ProfileUpdateDetail = { name?: string | null; image?: string | null }
type AgentSwitchIntent =
    | { type: "existing"; href: string; sessionId: string; title: string }
    | { type: "new" }

function pickAgentSessionId(payload: any): string {
    const root = payload?.data ?? payload ?? {}
    const candidates = [
        root?.id,
        root?.sessionID,
        root?.sessionId,
        root?.info?.id,
        root?.data?.id,
    ]

    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate) return candidate
    }

    return ""
}

function extractAgentParentSessionId(payload: any): string {
    const root = payload?.data ?? payload ?? {}
    const candidates = [
        root?.parentID,
        root?.parentId,
        root?.info?.parentID,
        root?.info?.parentId,
        root?.session?.parentID,
        root?.session?.parentId,
        root?.data?.parentID,
        root?.data?.parentId,
    ]

    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate) return candidate
    }
    return ""
}

function normalizeAgentSessions(payload: any): AgentSession[] {
    const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.sessions)
                ? payload.sessions
                : []

    return list
        .map((item: any) => {
            const root = item?.data ?? item ?? {}
            const id = String(root?.id || "")
            if (!id) return null
            return {
                id,
                title: typeof root?.title === "string" ? root.title : undefined,
                parentID: typeof root?.parentID === "string" ? root.parentID : undefined,
                parentId: typeof root?.parentId === "string" ? root.parentId : undefined,
                time: root?.time && typeof root.time === "object"
                    ? {
                        created: typeof root.time.created === "number" ? root.time.created : undefined,
                        updated: typeof root.time.updated === "number" ? root.time.updated : undefined,
                    }
                    : undefined,
            } as AgentSession
        })
        .filter((item: AgentSession | null): item is AgentSession => !!item)
}

function isAgentBusyStatus(input: unknown): boolean {
    const obj = (input && typeof input === "object") ? (input as Record<string, unknown>) : null
    const raw =
        (typeof input === "string" && input) ||
        (typeof obj?.type === "string" && obj.type) ||
        (typeof obj?.status === "string" && obj.status) ||
        ""
    const value = raw.trim().toLowerCase()
    return value === "busy" || value === "retry" || value === "running" || value === "processing" || value === "pending"
}

export function Sidebar({ initialSession, ...props }: React.ComponentProps<typeof ShadcnSidebar> & { initialSession?: Session | null }) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const router = useRouter()
    const session = initialSession
    const { theme, setTheme } = useTheme()
    const { state, setOpen, isMobile, setOpenMobile } = useSidebar()

    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [agentSessions, setAgentSessions] = useState<AgentSession[]>([])
    const [projects, setProjects] = useState<ChatProject[]>([])
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null)
    const [renameProjectValue, setRenameProjectValue] = useState('')
    const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
    const [chatActiveStreams, setChatActiveStreams] = useState<Record<string, { statusText: string }>>({})
    const [agentActiveStreams, setAgentActiveStreams] = useState<Record<string, { statusText: string }>>({})
    const [creatingAgentSession, setCreatingAgentSession] = useState(false)
    const [confirmDeleteProject, setConfirmDeleteProject] = useState<{ id: string; name: string } | null>(null)
    const [confirmAgentSwitch, setConfirmAgentSwitch] = useState<AgentSwitchIntent | null>(null)
    const [liveProfile, setLiveProfile] = useState<ProfileUpdateDetail>({})
    const [dbProfileImage, setDbProfileImage] = useState<string | null>(null)
    const [myGroupCount, setMyGroupCount] = useState(0)

    const renameInputRef = useRef<HTMLInputElement>(null)
    const renameFolderInputRef = useRef<HTMLInputElement>(null)
    const currentSessionId = pathname?.split('/c/')?.[1]?.split('/')?.[0] || ''
    const currentAgentSessionId = searchParams?.get("mode") === "agent" ? (searchParams?.get("id") || "") : ""
    const localePrefix = pathname?.split('/')[1]?.length <= 5 ? `/${pathname?.split('/')[1]}` : ''

    // ─── 串流監聽 ────────────────────────────────────────────────────────
    useEffect(() => {
        const unsubscribe = streamStore.subscribeGenerating((entries) => {
            const next: Record<string, { statusText: string }> = {}
            entries.forEach(e => { next[e.sessionId] = { statusText: e.statusText } })
            setChatActiveStreams(next)
        })
        return () => unsubscribe()
    }, [])

    const fetchAgentSessions = useCallback(async () => {
        try {
            const agentRes = await fetch('/api/agent/opencode/session?roots=true', { cache: "no-store" })
            if (!agentRes.ok) {
                setAgentSessions([])
                return
            }

            const payload = await agentRes.json()
            const list = normalizeAgentSessions(payload)
                .filter((item) => !extractAgentParentSessionId(item))
                .sort((a, b) => (b.time?.updated ?? b.time?.created ?? 0) - (a.time?.updated ?? a.time?.created ?? 0))

            setAgentSessions(list)
        } catch {
            setAgentSessions([])
        }
    }, [])

    useEffect(() => {
        const syncActiveStreams = () => {
            const next: Record<string, { statusText: string }> = {}
            const { statuses } = getOpencodeEventSnapshot()
            for (const [sessionId, status] of Object.entries(statuses)) {
                if (!isAgentBusyStatus(status)) continue
                next[sessionId] = { statusText: "Agent 執行中" }
            }
            setAgentActiveStreams(next)
        }

        syncActiveStreams()
        const unsubscribeSnapshot = subscribeOpencodeSnapshot(syncActiveStreams)
        const unsubscribeEvents = subscribeOpencodeEvents((event) => {
            if (event.type === "session.created" || event.type === "session.updated" || event.type === "session.deleted") {
                void fetchAgentSessions()
            }
        })

        return () => {
            unsubscribeEvents()
            unsubscribeSnapshot()
        }
    }, [fetchAgentSessions])

    const activeStreams = useMemo(
        () => ({ ...chatActiveStreams, ...agentActiveStreams }),
        [chatActiveStreams, agentActiveStreams]
    )
    const currentAgentIsBusy =
        searchParams?.get("mode") === "agent" &&
        !!currentAgentSessionId &&
        !!agentActiveStreams[currentAgentSessionId]

    const navigateToAgentSession = useCallback((href: string) => {
        router.push(href)
        if (isMobile) setOpenMobile(false)
    }, [isMobile, router, setOpenMobile])

    const requestAgentSessionSwitch = (target: AgentSwitchIntent) => {
        if (target.type === "existing" && target.sessionId === currentAgentSessionId) {
            navigateToAgentSession(target.href)
            return
        }

        if (!currentAgentIsBusy) {
            if (target.type === "existing") {
                navigateToAgentSession(target.href)
                return
            }
            void startNewChat(true)
            return
        }

        setConfirmAgentSwitch(target)
    }

    useEffect(() => { fetchAll(); fetchProfileFromDb() }, [pathname, searchParams?.toString()])

    useEffect(() => {
        const onProfileUpdated = (event: Event) => {
            const detail = (event as CustomEvent<ProfileUpdateDetail>).detail
            if (detail?.name) setLiveProfile(prev => ({ ...prev, name: detail.name }))
            fetchProfileFromDb()
        }
        window.addEventListener("user:profile-updated", onProfileUpdated as EventListener)
        return () => window.removeEventListener("user:profile-updated", onProfileUpdated as EventListener)
    }, [])

    const fetchProfileFromDb = async () => {
        try {
            const res = await fetch("/api/user/profile", { cache: "no-store" })
            if (!res.ok) return
            const profile = await res.json()
            const image = typeof profile?.image === "string" ? profile.image : null
            const name = typeof profile?.name === "string" ? profile.name : null
            setDbProfileImage(image)
            if (name) setLiveProfile(prev => ({ ...prev, name }))
        } catch { }
    }

    const fetchAll = async () => {
        try {
            const [sessRes, projRes, groupRes] = await Promise.all([
                fetch('/api/chat/sessions?mode=normal'),
                fetch('/api/chat/projects'),
                fetch('/api/groups/my'),
            ])
            if (sessRes.ok) setSessions(await sessRes.json())
            if (projRes.ok) setProjects(await projRes.json())
            if (groupRes.ok) {
                const g = await groupRes.json()
                setMyGroupCount(Array.isArray(g) ? g.length : 0)
            }
            await fetchAgentSessions()
        } catch { }
    }

    // ─── 動作處理 ────────────────────────────────────────────────────────
    const startNewChat = async (skipBusyConfirm = false) => {
        const isAgentMode = searchParams?.get("mode") === "agent"
        if (!isAgentMode) {
            router.push(`${localePrefix}/chat`)
            if (isMobile) setOpenMobile(false)
            return
        }

        if (!skipBusyConfirm && currentAgentIsBusy) {
            setConfirmAgentSwitch({ type: "new" })
            return
        }

        if (creatingAgentSession) return

        try {
            setCreatingAgentSession(true)
            const res = await fetch('/api/agent/opencode/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            })
            if (!res.ok) throw new Error("create agent session failed")

            const payload = await res.json()
            const sessionId = pickAgentSessionId(payload)
            if (!sessionId) throw new Error("missing agent session id")

            void fetchAgentSessions()
            navigateToAgentSession(`${localePrefix}/chat?mode=agent&id=${encodeURIComponent(sessionId)}`)
        } catch {
            toast.error("建立 Agent 對話失敗")
        } finally {
            setCreatingAgentSession(false)
        }
    }

    const createProject = async (e?: React.MouseEvent) => {
        e?.stopPropagation()
        try {
            const res = await fetch('/api/chat/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: '新專案' })
            })
            const proj = await res.json()
            setProjects(prev => [proj, ...prev])
            setRenamingProjectId(proj.id); setRenameProjectValue(proj.name)
            toast.success("專案已建立")
        } catch { toast.error("建立失敗") }
    }

    const deleteSession = async (id: string, e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation()
        try {
            await fetch(`/api/chat/${id}`, { method: 'DELETE' })
            setSessions(prev => prev.filter(s => s.id !== id))
            if (pathname?.includes(id)) router.push(`${localePrefix}/chat`)
            toast.success("對話已刪除")
        } catch { toast.error("刪除失敗") }
    }

    const deleteAgentSession = async (sessionId: string, e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation()
        try {
            const res = await fetch(`/api/agent/opencode/session/${encodeURIComponent(sessionId)}`, { method: "DELETE" })
            if (!res.ok) throw new Error("delete failed")
            setAgentSessions(prev => prev.filter(s => s.id !== sessionId))
            if (currentAgentSessionId === sessionId) {
                router.push(`${localePrefix}/chat?mode=agent`)
            }
            toast.success("Agent 對話已刪除")
        } catch {
            toast.error("刪除失敗")
        }
    }

    const commitRename = async (id: string) => {
        if (!renameValue.trim()) { setRenamingId(null); return }
        try {
            await fetch(`/api/chat/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: renameValue.trim() }) })
            setSessions(prev => prev.map(s => s.id === id ? { ...s, title: renameValue.trim() } : s))
        } catch { }
        setRenamingId(null)
    }

    const commitRenameProject = async (id: string) => {
        if (!renameProjectValue.trim()) { setRenamingProjectId(null); return }
        try {
            await fetch(`/api/chat/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: renameProjectValue.trim() }) })
            setProjects(prev => prev.map(p => p.id === id ? { ...p, name: renameProjectValue.trim() } : p))
        } catch { }
        setRenamingProjectId(null)
    }

    const moveSession = async (sessionId: string, projectId: string | null) => {
        try {
            await fetch(`/api/chat/${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) })
            setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, projectId } : s))
            toast.success("已移動對話")
        } catch { }
    }

    const toggleFolder = (id: string) => {
        setCollapsedFolders(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    // ─── 資料整理 ────────────────────────────────────────────────────────
    const projectsWithLatest = useMemo(() => {
        return projects.map(p => {
            const chats = sessions.filter(s => s.projectId === p.id)
            const latest = chats.reduce((a, b) => a.updatedAt > b.updatedAt ? a : b, { updatedAt: p.updatedAt } as any)
            return { ...p, latestAt: latest.updatedAt }
        }).sort((a, b) => b.latestAt.localeCompare(a.latestAt))
    }, [projects, sessions])

    const unassigned = sessions.filter(s => !s.projectId)
    const isAdmin = (session?.user as any)?.role === 'admin' || (session?.user as any)?.role === 'super'
    const displayName = liveProfile.name ?? session?.user?.name ?? "User"
    const displayImage = dbProfileImage

    // ─── 渲染對話單元 (帶 Loading 動畫) ───────────────────────────────────
    const renderSession = (s: ChatSession) => {
        const isGenerating = !!activeStreams[s.id];
        const href = s.projectId ? `${localePrefix}/p/${s.projectId}/c/${s.id}` : `${localePrefix}/c/${s.id}`
        return (
            <div
                key={s.id}
                className={cn(
                    "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer transition-all duration-200 text-[13px]",
                    currentSessionId === s.id
                        ? "bg-primary/5 text-primary font-semibold shadow-[inset_0_0_0_1px_rgba(var(--primary),0.05)]"
                        : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => {
                    if (renamingId === s.id) return
                    requestAgentSessionSwitch({
                        type: "existing",
                        href,
                        sessionId: s.id,
                        title: s.title || "新對話",
                    })
                }}
            >
                {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 text-primary animate-spin" />
                ) : (
                    <MessageSquare className={cn("h-3.5 w-3.5 shrink-0 opacity-40", currentSessionId === s.id && "opacity-100")} />
                )}

                {renamingId === s.id ? (
                    <input
                        ref={renameInputRef}
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setRenamingId(null) }}
                        onBlur={() => commitRename(s.id)}
                        className="flex-1 bg-transparent outline-none border-none p-0 text-[13px]"
                        onClick={e => e.stopPropagation()}
                    />
                ) : (
                    <span className="flex-1 truncate tracking-tight">{s.title || '新對話'}</span>
                )}

                {renamingId !== s.id && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="p-1 rounded-md hover:bg-background/80" onClick={e => e.stopPropagation()}>
                                    <MoreHorizontal className="h-3.5 w-3.5 opacity-60" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-2xl shadow-xl border-border/40 backdrop-blur-xl">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenamingId(s.id); setRenameValue(s.title) }} className="gap-2 rounded-lg py-2">
                                    <Pencil className="h-3.5 w-3.5" /> 重命名
                                </DropdownMenuItem>
                                {(projects.length > 0 || s.projectId) && (
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger className="gap-2 rounded-lg py-2">
                                            <FolderInput className="h-3.5 w-3.5" /> 移至專案
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuPortal>
                                            <DropdownMenuSubContent className="w-48 rounded-2xl p-1.5 ml-1">
                                                {s.projectId && (
                                                    <DropdownMenuItem onClick={() => moveSession(s.id, null)} className="gap-2 rounded-lg">
                                                        <FolderOutput className="h-3.5 w-3.5" /> 移出專案
                                                    </DropdownMenuItem>
                                                )}
                                                {projects.map(p => (
                                                    s.projectId !== p.id && (
                                                        <DropdownMenuItem key={p.id} onClick={() => moveSession(s.id, p.id)} className="gap-2 rounded-lg">
                                                            <Folder className="h-3.5 w-3.5 opacity-50" /> {p.name}
                                                        </DropdownMenuItem>
                                                    )
                                                ))}
                                            </DropdownMenuSubContent>
                                        </DropdownMenuPortal>
                                    </DropdownMenuSub>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => deleteSession(s.id, e)} className="gap-2 rounded-lg py-2 text-destructive focus:bg-destructive/5">
                                    <Trash2 className="h-3.5 w-3.5" /> 刪除
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>
        );
    }

    const renderAgentSession = (s: AgentSession) => {
        const isActive = currentAgentSessionId === s.id
        const isGenerating = !!activeStreams[s.id]
        const href = `${localePrefix}/chat?mode=agent&id=${encodeURIComponent(s.id)}`
        return (
            <div
                key={s.id}
                className={cn(
                    "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer transition-all duration-200 text-[13px]",
                    isActive
                        ? "bg-primary/5 text-primary font-semibold shadow-[inset_0_0_0_1px_rgba(var(--primary),0.05)]"
                        : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => requestAgentSessionSwitch({
                    type: "existing",
                    href,
                    sessionId: s.id,
                    title: s.title || `Session ${s.id.slice(0, 8)}`,
                })}
            >
                {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 text-primary animate-spin" />
                ) : (
                    <Bot className={cn("h-3.5 w-3.5 shrink-0 opacity-40", isActive && "opacity-100")} />
                )}
                <span className="flex-1 truncate tracking-tight">{s.title || `Session ${s.id.slice(0, 8)}`}</span>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded-md hover:bg-background/80" onClick={e => e.stopPropagation()}>
                                <MoreHorizontal className="h-3.5 w-3.5 opacity-60" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 rounded-2xl shadow-xl border-border/40 backdrop-blur-xl">
                            <DropdownMenuItem onClick={(e) => deleteAgentSession(s.id, e)} className="gap-2 rounded-lg py-2 text-destructive focus:bg-destructive/5">
                                <Trash2 className="h-3.5 w-3.5" /> 刪除
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        )
    }

    return (<>
        <ShadcnSidebar collapsible="icon" className="border-r border-border/30 bg-muted/20 backdrop-blur-sm" {...props}>
            {/* Header */}
            <SidebarHeader className={cn(
                "h-16 flex flex-row items-center",
                state === 'collapsed' ? "justify-center" : "justify-between"
            )}>
                <div className={cn(
                    "flex items-center gap-3 transition-all duration-300 overflow-hidden",
                    state === 'collapsed' ? "w-0 opacity-0" : "w-auto opacity-100"
                )}>
                    <button onClick={() => router.push('/')} className="flex items-center gap-2.5 pl-3 outline-none group shrink-0">
                        <div className="p-1.5 rounded-xl bg-primary/10 group-hover:scale-110 transition-transform">
                            <UnieAIIcon className="size-4 text-primary" />
                        </div>
                        <span className="font-bold tracking-tight text-foreground/90 text-sm">UnieAI</span>
                    </button>
                </div>

                {state === 'collapsed' ? (
                    <div className="mx-auto p-1.5 rounded-xl bg-primary/10 cursor-pointer" onClick={() => setOpen(true)}>
                        <UnieAIIcon className="size-4 text-primary" />
                    </div>
                ) : (
                    <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground/60 transition-all shrink-0">
                        <PanelLeftClose className="h-4 w-4" />
                    </button>
                )}
            </SidebarHeader>

            <SidebarContent className="px-1 pb-4 space-y-6 scrollbar-hide overflow-x-hidden">
                {/* 新對話與建立專案 膠囊 */}
                <div className={cn(state === 'expanded' ? "px-2 pt-2" : "")}>
                    <div className={cn(
                        "group flex items-center bg-background shadow-sm rounded-[20px] border border-border/50 hover:border-primary/30 transition-all duration-300 overflow-hidden",
                        state === 'collapsed' ? "p-1.5 h-8 w-8 mx-auto justify-center" : "h-11 px-1.5 "
                    )}>
                        <button
                            onClick={startNewChat}
                            disabled={creatingAgentSession}
                            className={cn(
                                "flex items-center gap-2 font-bold transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-60",
                                state === 'expanded' ? "flex-1 h-full text-left" : "justify-center shrink-0"
                            )}
                        >
                            {creatingAgentSession ? (
                                <Loader2 className="size-4 shrink-0 animate-spin" />
                            ) : (
                                <Plus className="size-4 shrink-0" />
                            )}
                            {state === 'expanded' && (creatingAgentSession ? "建立中..." : "新對話")}
                        </button>

                        {state === 'expanded' && (
                            <button
                                onClick={createProject}
                                className="p-2 rounded-full hover:bg-muted text-muted-foreground/50 hover:text-primary transition-all shrink-0"
                                title="建立專案"
                            >
                                <FolderPlus className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* 對話清單區塊 */}
                <div className="space-y-1">
                    {state === 'expanded' && (
                        <div className="flex items-center justify-between px-4 mb-2 group/title">
                            <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">專案列表</p>
                            <button onClick={createProject} className="opacity-0 group-hover/title:opacity-100 p-1 hover:bg-muted rounded-md transition-all">
                                <Plus className="h-3 w-3 text-muted-foreground" />
                            </button>
                        </div>
                    )}

                    {state === 'expanded' && projectsWithLatest.map(p => {
                        const folderSessions = sessions.filter(s => s.projectId === p.id);
                        const isOpen = !collapsedFolders.has(p.id);
                        const isProjectActive = pathname?.includes(`/p/${p.id}`);
                        const isFolderGenerating = folderSessions.some(s => activeStreams[s.id]);

                        return (
                            <div key={p.id} className="mb-1">
                                <div className={cn(
                                    "group flex items-center gap-1 px-2 py-1.5 rounded-xl transition-all cursor-pointer",
                                    isProjectActive ? "bg-primary/5 text-primary shadow-[inset_0_0_0_1px_rgba(var(--primary),0.05)]" : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                )}>
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFolder(p.id); }}
                                        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                                    >
                                        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200 opacity-60", isOpen && "rotate-90 opacity-100")} />
                                    </button>

                                    <div className="flex-1 flex items-center gap-2 min-w-0" onClick={() => router.push(`/p/${p.id}`)}>
                                        {isFolderGenerating ? (
                                            <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                                        ) : (
                                            <Folder className={cn("h-4 w-4 shrink-0 transition-colors", isProjectActive ? "text-amber-500 fill-amber-500/10" : "opacity-40")} />
                                        )}

                                        {renamingProjectId === p.id ? (
                                            <input
                                                ref={renameFolderInputRef}
                                                autoFocus
                                                value={renameProjectValue}
                                                onChange={e => setRenameProjectValue(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') commitRenameProject(p.id); if (e.key === 'Escape') setRenamingProjectId(null); }}
                                                onBlur={() => commitRenameProject(p.id)}
                                                className="flex-1 text-xs bg-transparent outline-none border-none p-0 font-medium"
                                                onClick={e => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span className="flex-1 text-[13px] font-medium truncate tracking-tight">{p.name}</span>
                                        )}
                                    </div>

                                    <div className="opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="p-1 rounded-md hover:bg-muted text-muted-foreground" onClick={e => e.stopPropagation()}>
                                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-2xl w-40 backdrop-blur-xl border-border/40 shadow-2xl">
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenamingProjectId(p.id); setRenameProjectValue(p.name) }} className="gap-2 rounded-lg py-2">
                                                    <Pencil className="h-3.5 w-3.5" /> 重命名
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteProject({ id: p.id, name: p.name }) }}
                                                    className="gap-2 rounded-lg py-2 text-destructive focus:bg-destructive/5"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" /> 刪除專案
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>

                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                            <div className="ml-5 pl-3 border-l border-border/40 mt-0.5 mb-1 space-y-0.5">
                                                {folderSessions.length > 0 ? folderSessions.map(renderSession) : <p className="py-1 px-3 text-[11px] text-muted-foreground/40 italic">空專案</p>}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })}

                    {unassigned.length > 0 && (
                        <div className="pt-2">
                            {state === 'expanded' && <p className="px-4 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-2">最近對話</p>}
                            <div className="space-y-0.5">
                                {unassigned.map(s => state === 'collapsed' ? (
                                    <button
                                        key={s.id}
                                        onClick={() => requestAgentSessionSwitch({
                                            type: "existing",
                                            href: `${localePrefix}/c/${s.id}`,
                                            sessionId: s.id,
                                            title: s.title || "新對話",
                                        })}
                                        className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl hover:bg-muted/50 mb-1 relative border border-transparent hover:border-border/50"
                                    >
                                        {activeStreams[s.id] ? (
                                            <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                        ) : (
                                            <MessageSquare className="h-4 w-4 text-muted-foreground/50" />
                                        )}
                                        {activeStreams[s.id] && <div className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" />}
                                    </button>
                                ) : renderSession(s))}
                            </div>
                        </div>
                    )}

                    {agentSessions.length > 0 && (
                        <div className="pt-2">
                            {state === 'expanded' && <p className="px-4 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-2">Agent 對話</p>}
                            <div className="space-y-0.5">
                                {agentSessions.map(s => state === 'collapsed' ? (
                                    <button
                                        key={s.id}
                                        onClick={() => requestAgentSessionSwitch({
                                            type: "existing",
                                            href: `${localePrefix}/chat?mode=agent&id=${encodeURIComponent(s.id)}`,
                                            sessionId: s.id,
                                            title: s.title || `Session ${s.id.slice(0, 8)}`,
                                        })}
                                        className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl hover:bg-muted/50 mb-1 relative border border-transparent hover:border-border/50"
                                    >
                                        {activeStreams[s.id] ? (
                                            <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                        ) : (
                                            <Bot className={cn("h-4 w-4 text-muted-foreground/50", currentAgentSessionId === s.id && "text-primary")} />
                                        )}
                                        {activeStreams[s.id] && <div className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" />}
                                    </button>
                                ) : renderAgentSession(s))}
                            </div>
                        </div>
                    )}
                </div>
            </SidebarContent>

            {/* Footer: 用戶名片 */}
            <div className="mt-auto p-2 border-t border-border/40 bg-background/40 backdrop-blur-md">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex w-full items-center gap-3 p-2 rounded-2xl hover:bg-muted/60 transition-all outline-none">
                            <div className="relative shrink-0">
                                {displayImage ? (
                                    <img src={displayImage} alt="avatar" className="size-6 object-cover rounded-full ring-2 ring-background shadow-sm" />
                                ) : (
                                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center text-xs font-bold shrink-0">{displayName?.[0]?.toUpperCase()}</div>
                                )}
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                            </div>
                            {state === 'expanded' && (
                                <div className="flex-1 text-left min-w-0">
                                    <p className="text-sm font-semibold truncate text-foreground/90 leading-tight">{displayName}</p>
                                    <p className="text-[10px] text-muted-foreground truncate uppercase mt-1 tracking-tight">{(session?.user as any)?.role}</p>
                                </div>
                            )}
                            {state === 'expanded' && <ChevronUp className="h-4 w-4 text-muted-foreground/40" />}
                        </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent className="w-72 p-0 rounded-3xl shadow-2xl border-border/40 mb-3" side="right" align="end" sideOffset={12}>
                        <div className="bg-muted/30 p-5 border-b border-border/40">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">{displayName?.[0]?.toUpperCase()}</div>
                                <div className="flex-1 min-w-0"><h4 className="font-bold text-base truncate">{displayName}</h4><p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p></div>
                            </div>
                            <div className="grid grid-cols-3 gap-1 bg-background/50 p-1 rounded-xl border border-border/40">
                                {[{ id: 'light', icon: Sun, label: '亮色' }, { id: 'dark', icon: Moon, label: '深色' }, { id: 'system', icon: Monitor, label: '系統' }].map(t => (
                                    <button key={t.id} onClick={() => setTheme(t.id)} className={cn("flex flex-col items-center gap-1 py-2 rounded-lg transition-all", theme === t.id ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-muted/50")}><t.icon className="h-3.5 w-3.5" /><span className="text-[10px] font-medium">{t.label}</span></button>
                                ))}
                            </div>
                        </div>
                        <div className="p-2 space-y-1">
                            <Link href="/settings"><DropdownMenuItem className="rounded-xl px-3 py-2.5 gap-3 cursor-pointer"><Settings className="h-4 w-4 opacity-70" /> 帳戶與隱私設定</DropdownMenuItem></Link>
                            {myGroupCount > 0 && (
                                <Link href="/group"><DropdownMenuItem className="rounded-xl px-3 py-2.5 gap-3 cursor-pointer"><Users2 className="h-4 w-4 opacity-70" /> 群組列表</DropdownMenuItem></Link>
                            )}
                            {isAdmin && (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="rounded-xl px-3 py-2.5 gap-3 cursor-pointer"><Shield className="h-4 w-4 opacity-70 text-amber-500" /> 管理員工具箱</DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent className="w-56 rounded-2xl p-2 ml-1 shadow-2xl">
                                            <Link href="/admin/users"><DropdownMenuItem className="rounded-lg gap-2 cursor-pointer">使用者中心</DropdownMenuItem></Link>
                                            <Link href="/admin/groups"><DropdownMenuItem className="rounded-lg gap-2 cursor-pointer">群組管理</DropdownMenuItem></Link>
                                            <Link href="/admin/usage"><DropdownMenuItem className="rounded-lg gap-2 cursor-pointer">用量監控</DropdownMenuItem></Link>
                                            <Link href="/admin/chat"><DropdownMenuItem className="rounded-lg gap-2 cursor-pointer">聊天監控</DropdownMenuItem></Link>
                                            <DropdownMenuSeparator />
                                            <Link href="/admin/settings"><DropdownMenuItem className="rounded-lg gap-2 text-primary font-bold cursor-pointer">核心系統設定</DropdownMenuItem></Link>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                            )}
                        </div>
                        <div className="p-2 pt-0"><DropdownMenuSeparator className="mb-2" /><DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })} className="rounded-xl px-3 py-2.5 gap-3 cursor-pointer text-destructive focus:bg-destructive/10"><LogOut className="h-4 w-4" /> 登出帳號</DropdownMenuItem></div>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <SidebarRail />
        </ShadcnSidebar>

        {confirmDeleteProject && (
            <ConfirmDialog
                title={`永久刪除專案「${confirmDeleteProject.name}」`}
                message="確定要刪除嗎？這將會一併移除該專案內的所有對話，且無法復原。"
                confirmLabel="確認刪除"
                variant="danger"
                onConfirm={async () => {
                    const id = confirmDeleteProject.id;
                    try {
                        await fetch(`/api/chat/projects/${id}`, { method: 'DELETE' });
                        setProjects(prev => prev.filter(p => p.id !== id));
                        setSessions(prev => prev.filter(s => s.projectId !== id));
                        toast.success("專案已刪除");
                    } catch { toast.error("刪除失敗"); }
                    setConfirmDeleteProject(null);
                }}
                onCancel={() => setConfirmDeleteProject(null)}
            />
        )}
        {confirmAgentSwitch && (
            <ConfirmDialog
                title="目前 Session 仍在執行"
                message={
                    confirmAgentSwitch.type === "existing"
                        ? `這個 Agent session 還沒跑完，現在切到「${confirmAgentSwitch.title}」會中止目前工作。確定要切換嗎？`
                        : "這個 Agent session 還沒跑完，現在建立新 session 會中止目前工作。確定要繼續嗎？"
                }
                confirmLabel="仍要切換"
                cancelLabel="留在目前 Session"
                variant="danger"
                onConfirm={() => {
                    const action = confirmAgentSwitch
                    setConfirmAgentSwitch(null)
                    if (action.type === "existing") {
                        navigateToAgentSession(action.href)
                        return
                    }
                    void startNewChat(true)
                }}
                onCancel={() => setConfirmAgentSwitch(null)}
            />
        )}
    </>)
}
