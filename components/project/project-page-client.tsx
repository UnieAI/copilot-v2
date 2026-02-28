"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { MessageSquare, Plus, Trash2, Pencil } from "lucide-react"
import { toast } from "sonner"
import { ChatInterface } from "@/components/chat/chat-interface"

type Session = { id: string; title: string; updatedAt: string }
type AvailableModel = { value: string; label: string; providerName: string; providerPrefix: string }
type DBMessage = { id: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt?: string; attachments?: any[] }

export function ProjectPageClient({
    project,
    initialSessions,
    availableModels,
    initialSelectedModel,
    initialActiveSessionId,
    initialActiveMessages = [],
}: {
    project: { id: string; name: string }
    initialSessions: Session[]
    availableModels: AvailableModel[]
    initialSelectedModel: string
    initialActiveSessionId?: string
    initialActiveMessages?: DBMessage[]
}) {
    const router = useRouter()
    const [sessions, setSessions] = useState<Session[]>(initialSessions)
    const [activeSessionId, setActiveSessionId] = useState<string | undefined>(initialActiveSessionId)
    const [activeMessages, setActiveMessages] = useState<DBMessage[]>(initialActiveMessages)
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState("")

    // When the chat interface creates or updates a session
    const handleSessionCreated = useCallback((newId: string, title: string) => {
        setActiveSessionId(newId)
        setActiveMessages([])  // new session starts blank
        setSessions(prev => {
            const existing = prev.find(s => s.id === newId)
            if (existing) {
                if (title) return prev.map(s => s.id === newId ? { ...s, title } : s)
                return prev
            }
            return [{ id: newId, title: title || 'New Chat', updatedAt: new Date().toISOString() }, ...prev]
        })
        // Update URL to reflect the new chat within project context
        window.history.pushState({}, '', `/p/${project.id}/c/${newId}`)
    }, [project.id])

    const handleSelectSession = (id: string) => {
        router.push(`/p/${project.id}/c/${id}`)
    }

    const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            await fetch(`/api/chat/${id}`, { method: "DELETE" })
            setSessions(prev => prev.filter(s => s.id !== id))
            if (activeSessionId === id) {
                setActiveSessionId(undefined)
            }
            toast.success("對話已刪除")
        } catch {
            toast.error("刪除失敗")
        }
    }

    const handleStartRename = (s: Session, e: React.MouseEvent) => {
        e.stopPropagation()
        setRenamingId(s.id)
        setRenameValue(s.title)
    }

    const handleCommitRename = async (id: string) => {
        if (!renameValue.trim()) { setRenamingId(null); return }
        try {
            await fetch(`/api/chat/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: renameValue.trim() }),
            })
            setSessions(prev => prev.map(s => s.id === id ? { ...s, title: renameValue.trim() } : s))
        } catch { toast.error("重命名失敗") }
        setRenamingId(null)
    }

    const handleCreateNew = () => {
        setActiveSessionId(undefined)
        setActiveMessages([])
        const fresh = Date.now()
        router.push(`/p/${project.id}?fresh=${fresh}`)
    }

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* ── Left Panel: Chat List ─────────────────────────── */}
            <div className="w-72 shrink-0 flex flex-col border-r border-border/50 bg-background">
                {/* Header */}
                <div className="px-4 py-4 border-b border-border/40">
                    <h2 className="text-sm font-semibold truncate">{project.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{sessions.length} 個對話</p>
                </div>

                {/* New Chat button */}
                <div className="px-3 py-3 border-b border-border/40">
                    <button
                        type="button"
                        onClick={handleCreateNew}
                        className="w-full flex items-center gap-2 h-9 px-3 rounded-xl border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/50 transition-all"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        新對話
                    </button>
                </div>

                {/* Session List */}
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
                    {sessions.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground text-center py-6">此專案尚無對話</p>
                    ) : (
                        sessions.map(s => (
                            <div
                                key={s.id}
                                onClick={() => handleSelectSession(s.id)}
                                className={`group flex items-center gap-1.5 rounded-[10px] px-2.5 py-2 cursor-pointer transition-colors text-sm ${activeSessionId === s.id
                                    ? "bg-muted/80 text-foreground font-medium"
                                    : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <MessageSquare className="h-3 w-3 shrink-0 opacity-50" />

                                {renamingId === s.id ? (
                                    <input
                                        autoFocus
                                        value={renameValue}
                                        onChange={e => setRenameValue(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === "Enter") handleCommitRename(s.id)
                                            if (e.key === "Escape") setRenamingId(null)
                                        }}
                                        onBlur={() => handleCommitRename(s.id)}
                                        onClick={e => e.stopPropagation()}
                                        className="flex-1 bg-transparent outline-none border-b border-primary text-xs"
                                    />
                                ) : (
                                    <span className="flex-1 truncate text-xs">{s.title || "New Chat"}</span>
                                )}

                                {renamingId !== s.id && (
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button
                                            onClick={e => handleStartRename(s, e)}
                                            className="p-0.5 rounded hover:text-foreground"
                                            title="重命名"
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </button>
                                        <button
                                            onClick={e => handleDeleteSession(s.id, e)}
                                            className="p-0.5 rounded hover:text-destructive"
                                            title="刪除"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ── Right Panel: Chat Interface ────────────────────── */}
            <div className="flex-1 min-w-0 overflow-hidden">
                <ChatInterface
                    key={activeSessionId ?? 'new'}
                    sessionId={activeSessionId}
                    availableModels={availableModels}
                    initialSelectedModel={initialSelectedModel}
                    initialMessages={activeMessages as any[]}
                    projectId={project.id}
                    onSessionCreated={handleSessionCreated}
                />
            </div>
        </div>
    )
}
