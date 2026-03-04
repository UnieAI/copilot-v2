import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { users, userPhotos, userGroups, groups, groupProviders } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { isAdminSession, getGroupMembership } from "@/lib/group-permissions"
import { GroupDetailPage } from "@/components/group/group-detail-page"

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId = session.user.id as string
    const isSysAdmin = isAdminSession(session)

    const membership = await getGroupMembership(userId, id)
    if (!isSysAdmin && !membership) redirect("/")

    const group = await db.query.groups.findFirst({ where: eq(groups.id, id) })
    if (!group) redirect("/")

    const [memberCount] = await db.select({ count: sql<number>`count(*)::int` }).from(userGroups).where(eq(userGroups.groupId, id))
    const [providerCount] = await db.select({ count: sql<number>`count(*)::int` }).from(groupProviders).where(eq(groupProviders.groupId, id))

    const allUsers = await db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role, image: userPhotos.image })
        .from(users)
        .leftJoin(userPhotos, eq(userPhotos.userId, users.id))
        .orderBy(users.createdAt)

    // Fetch current group members with their roles for the initial state
    const groupMemberships = await db.query.userGroups.findMany({
        where: eq(userGroups.groupId, id),
    })
    const initialMembers = groupMemberships.map(gm => {
        const u = allUsers.find(u => u.id === gm.userId) || { id: gm.userId, name: null, email: "", role: "user", image: null }
        return { ...u, membershipRole: gm.role }
    })

    const groupWithMeta = {
        ...group,
        memberCount: memberCount?.count ?? 0,
        providerCount: providerCount?.count ?? 0,
        currentUserRole: membership?.role ?? null,
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <GroupDetailPage
                group={groupWithMeta as any}
                allUsers={allUsers as any}
                isSysAdmin={isSysAdmin}
                initialMembers={initialMembers as any}
                currentUserId={userId}
                currentUserSysRole={(session.user as any)?.role as string || "user"}
            />
        </div>
    )
}
