import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { DeleteUserButton } from "@/components/admin/delete-user-button"

const ROLE_LABELS: Record<string, string> = {
    super: '超級管理員',
    admin: '管理員',
    user: '用戶',
    pending: '待審核',
}

const ROLE_COLORS: Record<string, string> = {
    super: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    user: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

export default async function AdminUsersPage() {
    const session = await auth()
    const myRole = (session?.user as any)?.role as string
    if (!session?.user || !['admin', 'super'].includes(myRole)) redirect("/")

    const myId = session.user!.id as string
    const allUsers = await db.query.users.findMany({ orderBy: (u, { asc }) => [asc(u.createdAt)] })

    // ─── Server Actions ────────────────────────────────────────────────────────

    const changeRole = async (formData: FormData) => {
        "use server"
        const session = await auth()
        const actorRole = (session?.user as any)?.role as string
        if (!['admin', 'super'].includes(actorRole)) return

        const targetId = formData.get("userId") as string
        const newRole = formData.get("role") as string

        // Never allow setting anyone to "super" via this form
        if (newRole === 'super') return

        const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, targetId)).limit(1)
        if (!target || target.role === 'super') return
        if (target.role === 'admin' && actorRole !== 'super') return

        await db.update(users).set({ role: newRole }).where(eq(users.id, targetId))
        revalidatePath("/admin/users")
    }

    const deleteUser = async (formData: FormData) => {
        "use server"
        const session = await auth()
        const actorRole = (session?.user as any)?.role as string
        if (!['admin', 'super'].includes(actorRole)) return

        const targetId = formData.get("userId") as string
        const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, targetId)).limit(1)
        if (!target || !['user', 'pending'].includes(target.role)) return

        await db.delete(users).where(eq(users.id, targetId))
        revalidatePath("/admin/users")
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 flex-shrink-0 border-b border-border/40 bg-background/95 backdrop-blur px-6 py-4 md:px-8">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl md:text-2xl font-medium tracking-tight">使用者管理</h1>
                        <p className="text-sm text-muted-foreground mt-0.5 font-normal">管理所有使用者的帳號角色與存取權限</p>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-8 md:px-8">
                <div className="max-w-5xl mx-auto space-y-8 pb-12">
                    <div className="rounded-[16px] border border-border/40 overflow-hidden shadow-sm bg-background">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/40">
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">使用者</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">角色</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">登入方式</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">加入日期</th>
                                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {allUsers.map(u => {
                                    const isSelf = u.id === myId
                                    const isTargetSuper = u.role === 'super'
                                    const isTargetAdmin = u.role === 'admin'
                                    const canEdit = !isSelf && !isTargetSuper && !(isTargetAdmin && myRole !== 'super')
                                    const canDelete = !isSelf && ['user', 'pending'].includes(u.role)

                                    return (
                                        <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {u.image ? (
                                                        <img src={u.image} className="h-8 w-8 rounded-full object-cover" alt="" />
                                                    ) : (
                                                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                            {u.name?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium">{u.name || '(未命名)'}</p>
                                                        <p className="text-xs text-muted-foreground">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] || ''}`}>
                                                    {ROLE_LABELS[u.role] || u.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">{u.provider || '-'}</td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {new Date(u.createdAt).toLocaleDateString('zh-TW')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    {canEdit ? (
                                                        <form action={changeRole} className="flex items-center gap-2">
                                                            <input type="hidden" name="userId" value={u.id} />
                                                            <select
                                                                name="role"
                                                                defaultValue={u.role}
                                                                className="h-9 rounded-xl border border-input/60 bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium"
                                                            >
                                                                <option value="pending">待審核</option>
                                                                <option value="user">用戶</option>
                                                                <option value="admin">管理員</option>
                                                                {/* "super" is intentionally NOT listed — only one super can exist */}
                                                            </select>
                                                            <button type="submit" className="h-9 px-4 text-xs font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm active:scale-95">
                                                                更新
                                                            </button>
                                                        </form>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    )}

                                                    {canDelete && (
                                                        <DeleteUserButton
                                                            userId={u.id}
                                                            userName={u.name || u.email}
                                                            deleteAction={deleteUser}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                        {allUsers.length === 0 && (
                            <div className="py-12 text-center text-sm text-muted-foreground">尚無使用者資料</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
