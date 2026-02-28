"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useState, useEffect, useRef } from "react"
import {
    MessageSquare, Settings, Users, SlidersHorizontal,
    Plus, Trash2, LogOut, Sun, Moon, Monitor,
    PanelLeftClose, PanelLeftOpen, Pencil, Check, X,
    FolderPlus, Folder, FolderOpen, ChevronRight, ChevronDown,
    MoreHorizontal, FolderInput, FolderOutput, Search, MessageCircle
} from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

import {
    Sidebar as ShadcnSidebar,
    SidebarContent,
    SidebarHeader,
    SidebarRail,
    useSidebar,
} from '@/components/ui/sidebar';

type ChatSession = {
    id: string
    title: string
    updatedAt: string
    projectId: string | null
}

type ChatProject = {
    id: string
    name: string
    updatedAt: string
}

export function Sidebar({ ...props }: React.ComponentProps<typeof ShadcnSidebar>) {
    const pathname = usePathname()
    const router = useRouter()
    const { data: session } = useSession()
    const { theme, setTheme } = useTheme()
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [projects, setProjects] = useState<ChatProject[]>([])
    const [mounted, setMounted] = useState(false)

    const { state, setOpen, setOpenMobile, isMobile } = useSidebar()

    // Rename chat state
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')

    // Rename folder state
    const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null)
    const [renameProjectValue, setRenameProjectValue] = useState('')

    // Collapsed folders
    const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())

    // Move-to-folder menu
    const [moveMenuId, setMoveMenuId] = useState<string | null>(null)

    // Confirm delete project dialog
    const [confirmDeleteProject, setConfirmDeleteProject] = useState<{ id: string; name: string } | null>(null)

    const renameInputRef = useRef<HTMLInputElement>(null)
    const renameFolderInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { setMounted(true) }, [])
    useEffect(() => { fetchAll() }, [pathname])
    useEffect(() => {
        const handler = () => fetchAll()
        window.addEventListener('sidebar:refresh', handler)
        return () => window.removeEventListener('sidebar:refresh', handler)
    }, [])

    // Auto-collapse sidebar when entering project pages
    useEffect(() => {
        if (pathname?.includes('/p/')) {
            setOpen(false)
        }
    }, [pathname])

    // Close move menu on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (moveMenuId && !(e.target as Element)?.closest('[data-move-menu]')) {
                setMoveMenuId(null)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [moveMenuId])

    useEffect(() => {
        if (renamingId) renameInputRef.current?.focus()
    }, [renamingId])

    useEffect(() => {
        if (renamingProjectId) renameFolderInputRef.current?.focus()
    }, [renamingProjectId])

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

    // ─── Session Actions ──────────────────────────────────────────────────────

    const deleteSession = async (id: string, e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation()
        try {
            await fetch(`/api/chat/${id}`, { method: 'DELETE' })
            setSessions(prev => prev.filter(s => s.id !== id))
            if (pathname?.includes(id)) router.push('/chat')
            toast.success("對話已刪除")
        } catch { toast.error("刪除失敗") }
    }

    const startRename = (s: ChatSession, e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation()
        setRenamingId(s.id); setRenameValue(s.title)
    }

    const commitRename = async (id: string) => {
        if (!renameValue.trim()) { setRenamingId(null); return }
        try {
            await fetch(`/api/chat/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: renameValue.trim() }) })
            setSessions(prev => prev.map(s => s.id === id ? { ...s, title: renameValue.trim() } : s))
        } catch { toast.error("重命名失敗") }
        setRenamingId(null)
    }

    const moveSession = async (sessionId: string, projectId: string | null) => {
        setMoveMenuId(null)
        try {
            await fetch(`/api/chat/${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) })
            setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, projectId } : s))
        } catch { toast.error("移動失敗") }
    }

    // ─── Project Actions ──────────────────────────────────────────────────────

    const createProject = async () => {
        try {
            const res = await fetch('/api/chat/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '新資料夾' }) })
            const proj = await res.json()
            setProjects(prev => [proj, ...prev])
            // Immediately start renaming the new folder
            setRenamingProjectId(proj.id); setRenameProjectValue(proj.name)
        } catch { toast.error("建立失敗") }
    }

    const startRenameProject = (p: ChatProject, e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation()
        setRenamingProjectId(p.id); setRenameProjectValue(p.name)
    }

    const commitRenameProject = async (id: string) => {
        if (!renameProjectValue.trim()) { setRenamingProjectId(null); return }
        try {
            await fetch(`/api/chat/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: renameProjectValue.trim() }) })
            setProjects(prev => prev.map(p => p.id === id ? { ...p, name: renameProjectValue.trim() } : p))
        } catch { toast.error("重命名失敗") }
        setRenamingProjectId(null)
    }

    const deleteProject = async (id: string, e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation()
        const project = projects.find(p => p.id === id)
        setConfirmDeleteProject({ id, name: project?.name || '此資料夾' })
    }

    const confirmDeleteProjectAction = async () => {
        if (!confirmDeleteProject) return
        const { id } = confirmDeleteProject
        setConfirmDeleteProject(null)
        try {
            await fetch(`/api/chat/projects/${id}`, { method: 'DELETE' })
            setProjects(prev => prev.filter(p => p.id !== id))
            // Remove sessions that belonged to this project
            setSessions(prev => prev.filter(s => s.projectId !== id))
            // If currently viewing a session in this project, go home
            const sessionInProject = sessions.find(s => s.projectId === id && pathname?.includes(s.id))
            if (sessionInProject || pathname?.includes(`/p/${id}`)) router.push('/chat')
            toast.success("資料夾及所有對話已刪除")
        } catch { toast.error("刪除失敗") }
    }

    const toggleFolder = (id: string) => {
        setCollapsedFolders(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    // ─── Data ─────────────────────────────────────────────────────────────────

    const userRole = (session?.user as any)?.role
    const isAdmin = userRole === 'admin' || userRole === 'super'
    const currentSessionId = pathname?.split('/c/')?.[1]?.split('/')?.[0] || ''

    // Sort projects by latest chat's updatedAt
    const projectsWithLatest = projects.map(p => {
        const chats = sessions.filter(s => s.projectId === p.id)
        const latest = chats.reduce((a, b) => a.updatedAt > b.updatedAt ? a : b, { updatedAt: p.updatedAt } as any)
        return { ...p, latestAt: latest.updatedAt }
    }).sort((a, b) => b.latestAt.localeCompare(a.latestAt))

    const unassigned = sessions.filter(s => !s.projectId)

    const renderSession = (s: ChatSession) => (
        <div
            key={s.id}
            className={`group relative flex items-center gap-1.5 rounded-[12px] px-3 py-2 cursor-pointer transition-colors text-sm
                ${currentSessionId === s.id ? 'bg-muted/80 text-foreground font-medium' : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'}`}
            onClick={() => { if (renamingId !== s.id) router.push(s.projectId ? `/p/${s.projectId}/c/${s.id}` : `/c/${s.id}`) }}
        >
            <MessageSquare className="h-3 w-3 shrink-0 opacity-50" />

            {renamingId === s.id ? (
                <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setRenamingId(null) }}
                    onBlur={() => commitRename(s.id)}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 bg-transparent outline-none border-b border-primary text-xs"
                />
            ) : (
                <span className="flex-1 truncate">{s.title || 'New Chat'}</span>
            )}

            {renamingId !== s.id && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {/* Move to folder */}
                    <div className="relative" data-move-menu>
                        <button
                            onClick={e => { e.stopPropagation(); setMoveMenuId(moveMenuId === s.id ? null : s.id) }}
                            className="p-0.5 rounded hover:text-foreground"
                            title="移至資料夾"
                        >
                            <MoreHorizontal className="h-3 w-3" />
                        </button>
                        {moveMenuId === s.id && (
                            <div className="absolute right-0 top-5 z-50 w-44 bg-popover border border-border rounded-md shadow-lg py-1" data-move-menu>
                                {s.projectId ? (
                                    <button onClick={() => moveSession(s.id, null)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2">
                                        <FolderOutput className="h-3 w-3" /> 移出資料夾
                                    </button>
                                ) : null}
                                {projects.map(p => (
                                    s.projectId !== p.id && (
                                        <button key={p.id} onClick={() => moveSession(s.id, p.id)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2">
                                            <FolderInput className="h-3 w-3" /> {p.name}
                                        </button>
                                    )
                                ))}
                                {projects.length === 0 && !s.projectId && (
                                    <p className="px-3 py-1.5 text-xs text-muted-foreground">尚無資料夾</p>
                                )}
                            </div>
                        )}
                    </div>
                    <button onClick={e => startRename(s, e)} className="p-0.5 rounded hover:text-foreground" title="重命名">
                        <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={e => deleteSession(s.id, e)} className="p-0.5 rounded hover:text-destructive" title="刪除">
                        <Trash2 className="h-3 w-3" />
                    </button>
                </div>
            )}
        </div>
    )

    return (<>
        <ShadcnSidebar
            collapsible="icon"
            className="border-none !bg-transparent [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
            {...props}
        >
            <SidebarHeader className="pt-4 overflow-visible">
                <div className="relative flex h-[32px] items-center">
                    {/* Logo - fixed position on left */}
                    <div className={cn(
                        "absolute flex items-center justify-center group/logo",
                        state === 'expanded' ? "left-6" : "left-1"
                    )}>
                        <button
                            onClick={() => {
                                state === 'expanded' ? router.push('/') : window.location.href = '/chat'
                                isMobile && setOpenMobile(false)
                            }}
                            className="flex items-center gap-2 justify-center"
                        >
                            <div className={cn(
                                "flex-shrink-0 h-6 w-6 rounded bg-foreground text-background flex items-center justify-center text-xs font-bold transition-[transform,opacity] duration-300 ease-out hover:rotate-180 hover:duration-700 transform-gpu",
                                state === 'collapsed' && "group-hover/logo:opacity-0 group-hover/logo:scale-90"
                            )}>U</div>
                            {state === 'expanded' && (
                                <span className="text-sm font-semibold tracking-tight transition-opacity duration-300">UnieAI</span>
                            )}
                        </button>
                        {/* Expand button - only shows on hover when collapsed */}
                        {state === 'collapsed' && (
                            <button
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer opacity-0 scale-75 group-hover/logo:opacity-100 group-hover/logo:scale-100 transition-[opacity,transform] duration-300 ease-out transform-gpu"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOpen(true);
                                }}
                                aria-label="Expand sidebar"
                            >
                                <PanelLeftOpen className="h-5 w-5" />
                            </button>
                        )}
                    </div>

                    {/* Right side buttons - fade in/out */}
                    <div
                        className={cn(
                            "absolute right-4 flex items-center gap-1 transition-[opacity,right] duration-300 ease-out transform-gpu",
                            state === 'collapsed'
                                ? "opacity-0 pointer-events-none right-0"
                                : "opacity-100 pointer-events-auto"
                        )}
                    >
                        {/* 
                        <button className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors">
                            <Search className="h-4 w-4" />
                        </button>
                        */}
                        <button
                            onClick={() => {
                                if (isMobile) {
                                    setOpenMobile(false);
                                } else {
                                    setOpen(false);
                                }
                            }}
                            className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors"
                        >
                            <PanelLeftClose className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent className="[&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] relative overflow-hidden">
                {/* Collapsed layout Buttons */}
                <div
                    className={cn(
                        "absolute inset-0 px-6 pt-4 space-y-3 flex flex-col items-center transition-opacity duration-150 ease-out transform-gpu",
                        state === 'collapsed'
                            ? "opacity-100 pointer-events-auto delay-100"
                            : "opacity-0 pointer-events-none delay-0"
                    )}
                >
                    <div className="w-full flex flex-col items-center space-y-3">
                        <button
                            onClick={() => { window.location.href = '/chat' }}
                            className="h-10 w-10 flex items-center justify-center rounded-[14px] border border-border/40 bg-background hover:bg-muted/50 shadow-sm transition-all focus:ring-2 focus:ring-ring focus:outline-none"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                        <button onClick={createProject} className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-card hover:border-[1.5px] hover:border-border text-muted-foreground">
                            <FolderPlus className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="w-full flex flex-col items-center mt-auto space-y-3 pb-4">
                        <Link href="/settings" className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-card hover:border-[1.5px] hover:border-border text-muted-foreground">
                            <Settings className="h-4 w-4" />
                        </Link>
                    </div>
                </div>

                {/* Expanded Layout Areas */}
                <div
                    className={cn(
                        "flex flex-col h-full transition-opacity duration-150 ease-out transform-gpu",
                        state === 'collapsed'
                            ? "opacity-0 pointer-events-none delay-0"
                            : "opacity-100 pointer-events-auto delay-100"
                    )}
                >
                    <div className="px-6 pt-4 space-y-4">
                        {/* New Chat Button */}
                        <div className="w-full">
                            <button
                                onClick={() => { window.location.href = '/chat' }}
                                className="w-full flex items-center justify-between h-11 px-4 rounded-[16px] border border-border/40 shadow-sm bg-background hover:bg-muted/50 hover:shadow-md text-sm font-medium transition-all group/new-chat focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <div className="flex items-center gap-2">
                                    <Plus className="h-4 w-4" />
                                    新對話
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); createProject() }} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover/new-chat:opacity-100 transition-opacity" title="新增資料夾">
                                    <FolderPlus className="h-4 w-4" />
                                </button>
                            </button>
                        </div>
                    </div>

                    {/* Chat Lists and Folders Container */}
                    <div className="flex-1 overflow-hidden flex flex-col mt-4">
                        <div className="flex-1 overflow-y-auto px-6 space-y-1 pb-4 min-h-0">
                            {/* Folders */}
                            {projectsWithLatest.map(p => {
                                const folderSessions = sessions.filter(s => s.projectId === p.id)
                                    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                                const isOpen = !collapsedFolders.has(p.id)
                                const FolderIcon = isOpen ? FolderOpen : Folder
                                const isProjectActive = pathname?.includes(`/p/${p.id}`)

                                return (
                                    <div key={p.id}>
                                        {/* Folder row */}
                                        <div className={`group flex items-center gap-1.5 rounded-[12px] px-3 py-2 hover:bg-muted/50 transition-colors ${isProjectActive ? 'bg-muted/80' : ''
                                            }`}>
                                            {/* Chevron — toggles expand/collapse */}
                                            <button
                                                onClick={e => { e.stopPropagation(); toggleFolder(p.id) }}
                                                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                            >
                                                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                            </button>
                                            <FolderIcon className="h-3.5 w-3.5 text-amber-500 shrink-0" />

                                            {renamingProjectId === p.id ? (
                                                <input
                                                    ref={renameFolderInputRef}
                                                    value={renameProjectValue}
                                                    onChange={e => setRenameProjectValue(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') commitRenameProject(p.id); if (e.key === 'Escape') setRenamingProjectId(null) }}
                                                    onBlur={() => commitRenameProject(p.id)}
                                                    onClick={e => e.stopPropagation()}
                                                    className="flex-1 text-xs bg-transparent outline-none border-b border-primary"
                                                />
                                            ) : (
                                                // Folder name — navigates to /p/[id]
                                                <span
                                                    className="flex-1 text-xs font-medium truncate cursor-pointer hover:text-foreground"
                                                    onClick={() => router.push(`/p/${p.id}`)}
                                                >
                                                    {p.name}
                                                </span>
                                            )}

                                            <span className="text-[10px] text-muted-foreground/60 shrink-0">{folderSessions.length}</span>

                                            {renamingProjectId !== p.id && (
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <button onClick={e => startRenameProject(p, e)} className="p-0.5 rounded hover:text-foreground" title="重命名">
                                                        <Pencil className="h-3 w-3" />
                                                    </button>
                                                    <button onClick={e => deleteProject(p.id, e)} className="p-0.5 rounded hover:text-destructive" title="刪除資料夾">
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Chats inside folder */}
                                        {isOpen && (
                                            <div className="ml-5 space-y-0.5">
                                                {folderSessions.map(renderSession)}
                                                {folderSessions.length === 0 && (
                                                    <p className="text-[10px] text-muted-foreground/50 px-2 py-1">空資料夾</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}

                            {/* Unassigned chats */}
                            {unassigned.length > 0 && (
                                <>
                                    {projectsWithLatest.length > 0 && (
                                        <p className="text-[10px] font-medium text-muted-foreground/60 px-2 pt-2 pb-0.5">最近對話</p>
                                    )}
                                    <div className="space-y-0.5">
                                        {unassigned.map(renderSession)}
                                    </div>
                                </>
                            )}

                            {sessions.length === 0 && projects.length === 0 && (
                                <p className="text-xs text-muted-foreground px-2 py-4 text-center">尚無對話紀錄</p>
                            )}
                        </div>

                        {/* Bottom Settings & Admin Links */}
                        <div className="px-5 pb-3 space-y-1">
                            <Link href="/settings" className={`flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-sm transition-colors ${pathname?.includes('/settings') && !pathname?.includes('/admin') ? 'bg-muted/80 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}>
                                <Settings className="h-4 w-4" /> 設定
                            </Link>
                            {isAdmin && (
                                <>
                                    <Link href="/admin/users" className={`flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-sm transition-colors ${pathname?.includes('/admin/users') ? 'bg-muted/80 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}>
                                        <Users className="h-4 w-4" /> 使用者管理
                                    </Link>
                                    <Link href="/admin/settings" className={`flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-sm transition-colors ${pathname?.includes('/admin/settings') ? 'bg-muted/80 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}>
                                        <SlidersHorizontal className="h-4 w-4" /> 系統設定
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>

            </SidebarContent>

            <div className={cn(
                "px-6 pb-4 pt-2 border-t border-border/50",
                state === 'collapsed' ? "hidden" : "block"
            )}>
                {/* User Info and Theme Area */}
                <div className="flex items-center gap-2 mb-2">
                    {session?.user?.image ? (
                        <img src={session.user.image} alt="avatar" className="h-7 w-7 rounded-full" />
                    ) : (
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                            {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{session?.user?.name || 'User'}</p>
                        <p className="text-xs text-muted-foreground truncate">{(session?.user as any)?.role}</p>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-1 w-full">
                    <div className="flex gap-1 flex-1">
                        {mounted && (
                            <>
                                <button onClick={() => setTheme('light')} className={`flex-1 p-1.5 rounded text-xs flex items-center justify-center transition-colors ${theme === 'light' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}>
                                    <Sun className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setTheme('dark')} className={`flex-1 p-1.5 rounded text-xs flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}>
                                    <Moon className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setTheme('system')} className={`flex-1 p-1.5 rounded text-xs flex items-center justify-center transition-colors ${theme === 'system' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}>
                                    <Monitor className="h-3.5 w-3.5" />
                                </button>
                            </>
                        )}
                    </div>
                    <button onClick={() => signOut({ callbackUrl: '/login' })} className="p-1.5 rounded text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors" title="Logout">
                        <LogOut className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <SidebarRail />
        </ShadcnSidebar>

        {/* Custom Confirm Delete Dialog */}
        {
            confirmDeleteProject && (
                <ConfirmDialog
                    title={`刪除「${confirmDeleteProject.name}」`}
                    message="確定要刪除此資料夾嗎？資料夾內的所有對話也會一併刪除，此操作無法復原。"
                    confirmLabel="刪除"
                    cancelLabel="取消"
                    variant="danger"
                    onConfirm={confirmDeleteProjectAction}
                    onCancel={() => setConfirmDeleteProject(null)}
                />
            )
        }
    </>)
}
