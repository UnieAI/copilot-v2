import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export default async function AdminUsersPage() {
    const session = await auth()
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super')) {
        redirect("/")
    }

    const allUsers = await db.query.users.findMany({
        orderBy: (users, { desc }) => [desc(users.createdAt)],
    })

    const handleRoleChange = async (formData: FormData) => {
        "use server"
        const session = await auth()
        if (!session || (session.user.role !== 'admin' && session.user.role !== 'super')) return

        const targetUserId = formData.get("userId") as string
        const newRole = formData.get("role") as string

        const targetUser = await db.query.users.findFirst({ where: eq(users.id, targetUserId) })
        if (!targetUser) return

        // Admins cannot change roles of Super or other Admins
        if (session.user.role === 'admin') {
            if (targetUser.role === 'super' || targetUser.role === 'admin') {
                return // Unauthorized
            }
        }

        await db.update(users).set({ role: newRole }).where(eq(users.id, targetUserId))
        revalidatePath("/admin/users")
    }

    return (
        <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto">
            <h1 className="text-3xl font-bold mb-6">User Management</h1>
            <div className="border rounded-lg overflow-hidden flex flex-col">
                <table className="w-full text-left table-auto">
                    <thead className="bg-muted">
                        <tr>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Email</th>
                            <th className="px-4 py-3 font-medium">Provider</th>
                            <th className="px-4 py-3 font-medium">Role</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {allUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-muted/50">
                                <td className="px-4 py-3 font-semibold">{user.name || "N/A"}</td>
                                <td className="px-4 py-3">{user.email}</td>
                                <td className="px-4 py-3 text-xs uppercase bg-accent rounded inline-block px-2 py-1 mt-2">{user.provider || "oauth"}</td>
                                <td className="px-4 py-3 capitalize">{user.role}</td>
                                <td className="px-4 py-3">
                                    <form action={handleRoleChange} className="flex gap-2 items-center">
                                        <input type="hidden" name="userId" value={user.id} />
                                        <select
                                            name="role"
                                            defaultValue={user.role}
                                            className="border rounded p-1 bg-background text-sm"
                                            disabled={
                                                session.user.role === 'admin' && (user.role === 'admin' || user.role === 'super') ||
                                                user.role === 'super' // nobody can touch super except direct db edit
                                            }
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                        <button
                                            type="submit"
                                            className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded disabled:opacity-50"
                                            disabled={
                                                session.user.role === 'admin' && (user.role === 'admin' || user.role === 'super') ||
                                                user.role === 'super'
                                            }
                                        >
                                            Save
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
