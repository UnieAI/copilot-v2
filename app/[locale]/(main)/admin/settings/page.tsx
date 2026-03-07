import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import AdminSettingsClient from "@/components/admin/settings/admin-settings-client"
import { users } from "@/lib/db/schema"
import { getUserAgentRuntime, getUserAgentSettingsState } from "@/lib/agent/runtime"

export default async function AdminSettingsPage() {
    const session = await auth()
    if (!session || !session.user || ((session.user as any).role !== 'admin' && (session.user as any).role !== 'super')) {
        redirect("/")
    }

    const settings = await db.query.adminSettings.findFirst()
    const allUsers = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
        })
        .from(users)
        .orderBy(users.createdAt)

    const agentUsers = await Promise.all(
        allUsers.map(async (user) => ({
            ...user,
            settings: await getUserAgentSettingsState(user.id),
            runtime: await getUserAgentRuntime(user.id),
        }))
    )

    return <AdminSettingsClient initialSettings={settings} initialAgentUsers={agentUsers} />
}
