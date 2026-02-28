import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const ROLE_LABELS: Record<string, string> = {
    super: '超級管理員',
    admin: '管理員',
    user: '用戶',
    pending: '待審核'
}

const ROLE_COLORS: Record<string, string> = {
    super: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    user: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

export default async function AdminUsersPage() {
    const session = await auth()
    if (!session?.user || !((session.user as any).role === 'admin' || (session.user as any).role === 'super')) {
        redirect("/")
    }

    const myRole = (session.user as any).role as string
    const myId = session.user.id as string

    const allUsers = await db.query.users.findMany({ orderBy: (u, { asc }) => [asc(u.createdAt)] })

    const changeRole = async (formData: FormData) => {
        "use server"
        const targetId = formData.get("userId") as string
        const newRole = formData.get("role") as string
        await db.update(users).set({ role: newRole }).where(eq(users.id, targetId))
        revalidatePath("/admin/users")
    }

    return (
        <div className="p-6 max-w-5xl mx-auto h-full overflow-y-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-semibold">使用者管理</h1>
                <p className="text-sm text-muted-foreground mt-1">管理所有使用者的帳號角色與存取權限</p>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
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
                            const canEdit = u.id !== myId && !(u.role === 'super') && !(u.role === 'admin' && myRole !== 'super')
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
                                    <td className="px-4 py-3 text-right">
                                        {canEdit ? (
                                            <form action={changeRole} className="flex items-center justify-end gap-2">
                                                <input type="hidden" name="userId" value={u.id} />
                                                <select
                                                    name="role"
                                                    defaultValue={u.role}
                                                    className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                                >
                                                    <option value="pending">待審核</option>
                                                    <option value="user">用戶</option>
                                                    <option value="admin">管理員</option>
                                                    {myRole === 'super' && <option value="super">超級管理員</option>}
                                                </select>
                                                <button type="submit" className="h-7 px-3 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                                                    更新
                                                </button>
                                            </form>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
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
    )
}
