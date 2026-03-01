"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useState, useEffect, useRef, useMemo } from "react"
import {
    MessageSquare, Settings, Users, SlidersHorizontal, BarChart2, Shield, Layers3, Gauge,
    Plus, Trash2, LogOut, Sun, Moon, Monitor,
    PanelLeftClose, Pencil, ChevronRight, ChevronDown,
    MoreHorizontal, FolderInput, FolderOutput, Folder, FolderPlus,
    Users2, Loader2, Check, ChevronUp
} from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { streamStore } from "@/lib/stream-store"
import { UnieAIIcon } from "@/components/sidebar/unieai-logo"
import { motion, AnimatePresence } from "framer-motion"

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

type ChatSession = { id: string; title: string; updatedAt: string; projectId: string | null }
type ChatProject = { id: string; name: string; updatedAt: string }

export function Sidebar({ ...props }: React.ComponentProps<typeof ShadcnSidebar>) {
    const pathname = usePathname()
    const router = useRouter()
    const { data: session } = useSession()
    const { theme, setTheme } = useTheme()
    const { state, setOpen, isMobile, setOpenMobile } = useSidebar()

    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [projects, setProjects] = useState<ChatProject[]>([])
    const [mounted, setMounted] = useState(false)
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null)
    const [renameProjectValue, setRenameProjectValue] = useState('')
    const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
    const [activeStreams, setActiveStreams] = useState<Record<string, { statusText: string }>>({})
    const [confirmDeleteProject, setConfirmDeleteProject] = useState<{ id: string; name: string } | null>(null)

    const renameInputRef = useRef<HTMLInputElement>(null)
    const renameFolderInputRef = useRef<HTMLInputElement>(null)
    const currentSessionId = pathname?.split('/c/')?.[1]?.split('/')?.[0] || ''
    const localePrefix = pathname?.split('/')[1]?.length <= 5 ? `/${pathname?.split('/')[1]}` : ''

    // ─── 串流監聽 ────────────────────────────────────────────────────────
    useEffect(() => {
        const unsubscribe = streamStore.subscribeGenerating((entries) => {
            const next: Record<string, { statusText: string }> = {}
            entries.forEach(e => { next[e.sessionId] = { statusText: e.statusText } })
            setActiveStreams(next)
        })
        return () => unsubscribe()
    }, [])

    useEffect(() => { setMounted(true); fetchAll() }, [pathname])

    const fetchAll = async () => {
        try {
            const [sessRes, projRes] = await Promise.all([
                fetch('/api/chat/sessions'),
                fetch('/api/chat/projects'),
            ])
            if (sessRes.ok) setSessions(await sessRes.json())
            if (projRes.ok) setProjects(await projRes.json())
        } catch { }
    }

    // ─── 動作處理 ────────────────────────────────────────────────────────
    const startNewChat = () => {
        router.push(`${localePrefix}/chat?fresh=${Date.now()}`)
        if (isMobile) setOpenMobile(false)
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

    // ─── 渲染對話單元 (帶 Loading 動畫) ───────────────────────────────────
    const renderSession = (s: ChatSession) => {
        const isGenerating = !!activeStreams[s.id];
        return (
            <div
                key={s.id}
                className={cn(
                    "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer transition-all duration-200 text-[13px]",
                    currentSessionId === s.id
                        ? "bg-primary/5 text-primary font-semibold shadow-[inset_0_0_0_1px_rgba(var(--primary),0.05)]"
                        : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => { if (renamingId !== s.id) router.push(s.projectId ? `/p/${s.projectId}/c/${s.id}` : `/c/${s.id}`) }}
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

    return (<>
        <ShadcnSidebar collapsible="icon" className="border-r border-border/30 bg-muted/20 backdrop-blur-sm" {...props}>
            {/* Header: 修復後的 Logo 佈局 */}
            <SidebarHeader className="h-16 flex flex-row items-center px-4 justify-between">
                <div className={cn(
                    "flex items-center gap-3 transition-all duration-300 overflow-hidden",
                    state === 'collapsed' ? "w-0 opacity-0" : "w-auto opacity-100"
                )}>
                    <button onClick={() => router.push('/')} className="flex items-center gap-2.5 outline-none group shrink-0">
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

            <SidebarContent className="px-3 pb-4 space-y-6 scrollbar-hide overflow-x-hidden">
                {/* 新對話與建立專案 膠囊 */}
                <div className="px-2 pt-2">
                    <div className={cn(
                        "group flex items-center bg-background shadow-sm border border-border/50 rounded-[20px] hover:border-primary/30 transition-all duration-300 overflow-hidden",
                        state === 'collapsed' ? "w-11 h-11 mx-auto justify-center" : "h-11 px-1.5"
                    )}>
                        <button
                            onClick={startNewChat}
                            className={cn(
                                "flex items-center gap-3 font-bold text-[13.5px] transition-colors hover:text-primary",
                                state === 'expanded' ? "flex-1 pl-3 h-full text-left" : "justify-center shrink-0"
                            )}
                        >
                            <Plus className="h-4 w-4 shrink-0" />
                            {state === 'expanded' && "新對話"}
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
                                    <button key={s.id} onClick={() => router.push(`/c/${s.id}`)} className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl hover:bg-muted/50 mb-1 relative border border-transparent hover:border-border/50">
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
                </div>
            </SidebarContent>

            {/* Footer: 用戶名片 */}
            <div className="mt-auto p-4 border-t border-border/40 bg-background/40 backdrop-blur-md">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex w-full items-center gap-3 p-2 rounded-2xl hover:bg-muted/60 transition-all outline-none">
                            <div className="relative shrink-0">
                                {session?.user?.image ? (
                                    <img src={session.user.image} alt="avatar" className="h-9 w-9 rounded-full ring-2 ring-background shadow-sm" />
                                ) : (
                                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center text-xs font-bold shrink-0">{session?.user?.name?.[0]?.toUpperCase()}</div>
                                )}
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                            </div>
                            {state === 'expanded' && (
                                <div className="flex-1 text-left min-w-0">
                                    <p className="text-sm font-semibold truncate text-foreground/90 leading-tight">{session?.user?.name || 'User'}</p>
                                    <p className="text-[10px] text-muted-foreground truncate uppercase mt-1 tracking-tight">{(session?.user as any)?.role}</p>
                                </div>
                            )}
                            {state === 'expanded' && <ChevronUp className="h-4 w-4 text-muted-foreground/40" />}
                        </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent className="w-72 p-0 rounded-3xl shadow-2xl border-border/40 mb-3" side="right" align="end" sideOffset={12}>
                        <div className="bg-muted/30 p-5 border-b border-border/40">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">{session?.user?.name?.[0]?.toUpperCase()}</div>
                                <div className="flex-1 min-w-0"><h4 className="font-bold text-base truncate">{session?.user?.name}</h4><p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p></div>
                            </div>
                            <div className="grid grid-cols-3 gap-1 bg-background/50 p-1 rounded-xl border border-border/40">
                                {[{ id: 'light', icon: Sun, label: '亮色' }, { id: 'dark', icon: Moon, label: '深色' }, { id: 'system', icon: Monitor, label: '系統' }].map(t => (
                                    <button key={t.id} onClick={() => setTheme(t.id)} className={cn("flex flex-col items-center gap-1 py-2 rounded-lg transition-all", theme === t.id ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-muted/50")}><t.icon className="h-3.5 w-3.5" /><span className="text-[10px] font-medium">{t.label}</span></button>
                                ))}
                            </div>
                        </div>
                        <div className="p-2 space-y-1">
                            <Link href="/settings"><DropdownMenuItem className="rounded-xl px-3 py-2.5 gap-3 cursor-pointer"><Settings className="h-4 w-4 opacity-70" /> 帳戶與隱私設定</DropdownMenuItem></Link>
                            {isAdmin && (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="rounded-xl px-3 py-2.5 gap-3 cursor-pointer"><Shield className="h-4 w-4 opacity-70 text-amber-500" /> 管理員工具箱</DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent className="w-56 rounded-2xl p-2 ml-1 shadow-2xl">
                                            <Link href="/admin/users"><DropdownMenuItem className="rounded-lg gap-2">使用者中心</DropdownMenuItem></Link>
                                            <Link href="/admin/groups"><DropdownMenuItem className="rounded-lg gap-2">群組資源</DropdownMenuItem></Link>
                                            <Link href="/admin/usage"><DropdownMenuItem className="rounded-lg gap-2">用量監控</DropdownMenuItem></Link>
                                            <DropdownMenuSeparator /><Link href="/admin/settings"><DropdownMenuItem className="rounded-lg gap-2 text-primary font-bold">核心系統設定</DropdownMenuItem></Link>
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
    </>)
}