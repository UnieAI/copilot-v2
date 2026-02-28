"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import {
    MessageSquare, Settings, Users, SlidersHorizontal,
    Plus, Trash2, LogOut, Sun, Moon, Monitor, ChevronRight,
    PanelLeftClose, PanelLeft
} from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

type ChatSession = {
    id: string
    title: string
    updatedAt: string
}

export function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { data: session } = useSession()
    const { theme, setTheme } = useTheme()
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [mounted, setMounted] = useState(false)
    const [collapsed, setCollapsed] = useState(false)

    useEffect(() => { setMounted(true) }, [])

    useEffect(() => {
        fetchSessions()
    }, [pathname])

    useEffect(() => {
        // Re-fetch when chat-interface signals a title was generated
        const handler = () => fetchSessions()
        window.addEventListener('sidebar:refresh', handler)
        return () => window.removeEventListener('sidebar:refresh', handler)
    }, [])

    const fetchSessions = async () => {
        try {
            const res = await fetch('/api/chat/sessions')
            if (res.ok) setSessions(await res.json())
        } catch { }
    }

    const deleteSession = async (id: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        try {
            await fetch(`/api/chat/${id}`, { method: 'DELETE' })
            setSessions(prev => prev.filter(s => s.id !== id))
            if (pathname.includes(id)) {
                router.push('/')
            }
            toast.success("對話已刪除")
        } catch {
            toast.error("刪除失敗")
        }
    }

    const userRole = (session?.user as any)?.role
    const isAdmin = userRole === 'admin' || userRole === 'super'

    const currentSessionId = pathname?.split('/c/')?.[1]?.split('/')?.[0] || ''

    if (collapsed) {
        return (
            <aside className="w-12 h-full border-r border-border bg-background flex flex-col items-center py-4 gap-4">
                <button onClick={() => setCollapsed(false)} className="p-2 rounded-md hover:bg-muted text-muted-foreground">
                    <PanelLeft className="h-4 w-4" />
                </button>
                <Link href="/" className="p-2 rounded-md hover:bg-muted text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                </Link>
                <Link href="/settings" className="p-2 rounded-md hover:bg-muted text-muted-foreground">
                    <Settings className="h-4 w-4" />
                </Link>
            </aside>
        )
    }

    return (
        <aside className="w-64 h-full border-r border-border bg-background flex flex-col shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-foreground text-background flex items-center justify-center text-xs font-bold">U</div>
                    <span className="text-sm font-semibold tracking-tight">UnieAI Copilot</span>
                </div>
                <button onClick={() => setCollapsed(true)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                    <PanelLeftClose className="h-4 w-4" />
                </button>
            </div>

            {/* New Chat */}
            <div className="px-3 py-2">
                <Link href="/" className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm font-medium bg-muted/50 hover:bg-muted transition-colors">
                    <Plus className="h-4 w-4" />
                    新對話
                </Link>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
                {sessions.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">最近對話</p>
                )}
                {sessions.map(s => (
                    <div
                        key={s.id}
                        className={`group flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer transition-colors ${currentSessionId === s.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/70 text-muted-foreground hover:text-foreground'}`}
                        onClick={() => router.push(`/c/${s.id}`)}
                    >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        <span className="text-xs flex-1 truncate">{s.title || "New Chat"}</span>
                        <button
                            onClick={(e) => deleteSession(s.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-destructive transition-all"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    </div>
                ))}
                {sessions.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-4 text-center">尚無對話紀錄</p>
                )}
            </div>

            {/* Nav Links */}
            <div className="px-3 py-2 border-t border-border space-y-0.5">
                <Link
                    href="/settings"
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${pathname?.includes('/settings') && !pathname?.includes('/admin') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                >
                    <Settings className="h-4 w-4" />
                    設定
                </Link>
                {isAdmin && (
                    <>
                        <Link
                            href="/admin/users"
                            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${pathname?.includes('/admin/users') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                        >
                            <Users className="h-4 w-4" />
                            使用者管理
                        </Link>
                        <Link
                            href="/admin/settings"
                            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${pathname?.includes('/admin/settings') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                        >
                            <SlidersHorizontal className="h-4 w-4" />
                            系統設定
                        </Link>
                    </>
                )}
            </div>

            {/* User & Theme */}
            <div className="px-3 py-3 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                    {session?.user?.image ? (
                        <img src={session.user.image} alt="avatar" className="h-7 w-7 rounded-full" />
                    ) : (
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{session?.user?.name || 'User'}</p>
                        <p className="text-xs text-muted-foreground truncate">{(session?.user as any)?.role}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {mounted && (
                        <>
                            <button onClick={() => setTheme('light')} className={`flex-1 p-1.5 rounded text-xs flex items-center justify-center gap-1 transition-colors ${theme === 'light' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}>
                                <Sun className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setTheme('dark')} className={`flex-1 p-1.5 rounded text-xs flex items-center justify-center gap-1 transition-colors ${theme === 'dark' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}>
                                <Moon className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setTheme('system')} className={`flex-1 p-1.5 rounded text-xs flex items-center justify-center gap-1 transition-colors ${theme === 'system' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}>
                                <Monitor className="h-3.5 w-3.5" />
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="flex-1 p-1.5 rounded text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </aside>
    )
}
