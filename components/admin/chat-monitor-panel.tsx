"use client"

import { useMemo, useState } from "react"
import { ChatMonitorDialog } from "@/components/admin/chat-monitor-dialog"

type ChatMonitorUser = {
  id: string
  name: string | null
  email: string
  image: string | null
  role: string
  chatCount: number
}

const ROLE_LABELS: Record<string, string> = {
  super: "超級管理員",
  admin: "管理員",
  user: "使用者",
  pending: "待審核",
}

export function ChatMonitorPanel({ users }: { users: ChatMonitorUser[] }) {
  const [selectedUser, setSelectedUser] = useState<ChatMonitorUser | null>(null)
  const [keyword, setKeyword] = useState("")

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const name = (u.name || "").toLowerCase()
      const email = (u.email || "").toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [users, keyword])

  return (
    <>
      <div className="rounded-[16px] border border-border/40 shadow-sm bg-background overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
          <p className="text-sm font-medium">使用者聊天清單</p>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜尋名稱或 Email"
            className="h-9 w-60 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">使用者</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">角色</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">對話數量</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {u.image ? (
                      <img src={u.image} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {u.name?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{u.name || "(未命名)"}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{ROLE_LABELS[u.role] || u.role}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 bg-primary/10 text-primary text-xs font-semibold">
                    {u.chatCount}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setSelectedUser(u)}
                    className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    檢視聊天
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            找不到符合條件的使用者
          </div>
        )}
      </div>

      <ChatMonitorDialog
        open={!!selectedUser}
        onOpenChange={(open) => !open && setSelectedUser(null)}
        userId={selectedUser?.id || null}
        userName={selectedUser?.name || selectedUser?.email || "使用者"}
      />
    </>
  )
}

