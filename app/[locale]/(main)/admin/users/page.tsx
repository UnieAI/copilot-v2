import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { userPhotos, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { DeleteUserButton } from "@/components/admin/delete-user-button"
import { RoleSelect } from "@/components/admin/role-select"

type UserActionResult = {
  success: boolean
  message: string
}

const ROLE_LABELS: Record<string, string> = {
  super: "超級管理員",
  admin: "管理員",
  user: "一般使用者",
  pending: "待審核",
}

const ROLE_COLORS: Record<string, string> = {
  super: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  user: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

export default async function AdminUsersPage() {
  const session = await auth()
  const myRole = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user || !myRole || !["admin", "super"].includes(myRole)) redirect("/")

  const myId = session.user.id as string
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      provider: users.provider,
      createdAt: users.createdAt,
      image: userPhotos.image,
    })
    .from(users)
    .leftJoin(userPhotos, eq(userPhotos.userId, users.id))
    .orderBy(users.createdAt)

  const changeRole = async (formData: FormData): Promise<UserActionResult> => {
    "use server"

    const session = await auth()
    const actorRole = (session?.user as { role?: string } | undefined)?.role
    if (!actorRole || !["admin", "super"].includes(actorRole)) {
      return { success: false, message: "沒有權限執行此操作" }
    }

    const targetId = formData.get("userId") as string
    const newRole = formData.get("role") as string
    if (!targetId || !newRole) {
      return { success: false, message: "參數錯誤" }
    }
    if (newRole === "super") {
      return { success: false, message: "不允許設定為 super" }
    }

    const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, targetId)).limit(1)
    if (!target || target.role === "super") {
      return { success: false, message: "目標使用者不存在或不可編輯" }
    }
    if (target.role === "admin" && actorRole !== "super") {
      return { success: false, message: "只有 super 可以修改 admin 權限" }
    }

    try {
      const result = await db.update(users).set({ role: newRole }).where(eq(users.id, targetId))
      if (result.count > 0) {
        revalidatePath("/admin/users")
        return { success: true, message: "使用者權限變更完成" }
      }
      return { success: false, message: "未更新任何資料，請稍後重試" }
    } catch {
      return { success: false, message: "系統出錯，請稍後重試" }
    }
  }

  const deleteUser = async (formData: FormData): Promise<UserActionResult> => {
    "use server"

    const session = await auth()
    const actorRole = (session?.user as { role?: string } | undefined)?.role
    if (!actorRole || !["admin", "super"].includes(actorRole)) {
      return { success: false, message: "沒有權限執行此操作" }
    }

    const targetId = formData.get("userId") as string
    if (!targetId) {
      return { success: false, message: "參數錯誤" }
    }

    const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, targetId)).limit(1)
    if (!target || !["user", "pending"].includes(target.role)) {
      return { success: false, message: "目標使用者不存在或不可刪除" }
    }

    try {
      const result = await db.delete(users).where(eq(users.id, targetId))
      if (result.count > 0) {
        revalidatePath("/admin/users")
        return { success: true, message: "使用者已刪除" }
      }
      return { success: false, message: "未刪除任何資料，請稍後重試" }
    } catch {
      return { success: false, message: "系統出錯，請稍後重試" }
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="sticky top-0 z-10 flex-shrink-0 border-b border-border/40 bg-background/95 backdrop-blur px-6 py-4 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-medium tracking-tight">使用者管理</h1>
            <p className="text-sm text-muted-foreground mt-0.5 font-normal">管理使用者角色與刪除一般帳號</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 md:px-8">
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
          <div className="rounded-[16px] border border-border/40 overflow-hidden shadow-sm bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">使用者</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">角色</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">登入方式</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">建立日期</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allUsers.map((u) => {
                  const isSelf = u.id === myId
                  const isTargetSuper = u.role === "super"
                  const isTargetAdmin = u.role === "admin"
                  const canEdit = !isSelf && !isTargetSuper && !(isTargetAdmin && myRole !== "super")
                  const canDelete = !isSelf && ["user", "pending"].includes(u.role)

                  return (
                    <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {u.image ? (
                            <img src={u.image} className="h-8 w-8 rounded-full object-cover" alt="" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {u.name?.[0]?.toUpperCase() || "?"}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{u.name || "(未命名)"}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] || ""}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.provider || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("zh-TW")}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit ? (
                            <RoleSelect userId={u.id} currentRole={u.role} changeAction={changeRole} />
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}

                          {canDelete && <DeleteUserButton userId={u.id} userName={u.name || u.email} deleteAction={deleteUser} />}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {allUsers.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">目前沒有使用者</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
