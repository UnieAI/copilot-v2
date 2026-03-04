import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { groups, userGroups, groupProviders } from "@/lib/db/schema"
import { eq, inArray, sql } from "drizzle-orm"
import { UserGroupsPage } from "@/components/group/user-groups-page"

export default async function GroupListPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId = session.user.id as string

    const memberships = await db.query.userGroups.findMany({
        where: eq(userGroups.userId, userId),
    })

    const membershipMap = new Map(memberships.map(m => [m.groupId, m.role]))

    const targetGroups = memberships.length === 0 ? [] : await db.query.groups.findMany({
        where: inArray(groups.id, memberships.map(m => m.groupId)),
        orderBy: (g, { asc }) => [asc(g.createdAt)],
    })

    const result = await Promise.all(
        targetGroups.map(async g => {
            const [memberCount] = await db.select({ count: sql<number>`count(*)::int` }).from(userGroups).where(eq(userGroups.groupId, g.id))
            const [providerCount] = await db.select({ count: sql<number>`count(*)::int` }).from(groupProviders).where(eq(groupProviders.groupId, g.id))
            return { ...g, memberCount: memberCount?.count ?? 0, providerCount: providerCount?.count ?? 0, currentUserRole: membershipMap.get(g.id) || null }
        })
    )

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="sticky top-0 z-10 flex-shrink-0 border-b border-border/40 bg-background/95 backdrop-blur px-6 py-4 md:px-8">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-xl md:text-2xl font-medium tracking-tight">我的群組</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">你所屬的所有群組</p>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
                <div className="max-w-3xl mx-auto">
                    <UserGroupsPage groups={result as any} />
                </div>
            </div>
        </div>
    )
}
