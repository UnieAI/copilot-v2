import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { users } from "@/lib/db/schema"
import { GroupsPanel } from "@/components/admin/groups-panel"

export default async function AdminGroupsPage() {
    const session = await auth()
    const myRole = (session?.user as any)?.role as string
    if (!session?.user || !["admin", "super"].includes(myRole)) redirect("/")

    const allUsers = await db.query.users.findMany({
        columns: { id: true, name: true, email: true, role: true, image: true },
        orderBy: (u, { asc }) => [asc(u.createdAt)],
    })

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 flex-shrink-0 border-b border-border/40 bg-background/95 backdrop-blur px-6 py-4 md:px-8">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-xl md:text-2xl font-medium tracking-tight">群組管理</h1>
                    <p className="text-sm text-muted-foreground mt-0.5 font-normal">
                        建立群組並為群組設定共用的 AI Provider
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
                <div className="max-w-6xl mx-auto h-full">
                    <GroupsPanel allUsers={allUsers as any} viewerRole={myRole} />
                </div>
            </div>
        </div>
    )
}
