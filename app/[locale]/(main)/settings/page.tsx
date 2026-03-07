import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { userPhotos, userProviders, mcpTools, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import SettingsClient from "@/components/settings/settings-client"
import { getUserAgentMcpServers, getUserAgentSkills } from "@/lib/agent/runtime"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id as string

  const dbUserRows = await db
    .select({
      name: users.name,
      email: users.email,
      image: userPhotos.image,
    })
    .from(users)
    .leftJoin(userPhotos, eq(userPhotos.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1)
  const dbUser = dbUserRows[0]

  const userProviderList = await db.query.userProviders.findMany({
    where: eq(userProviders.userId, userId),
  })

  const [userMcpTools, agentMcpServers, agentSkills] = await Promise.all([
    db.query.mcpTools.findMany({
      where: eq(mcpTools.userId, userId),
    }),
    getUserAgentMcpServers(userId),
    getUserAgentSkills(userId),
  ])

  return (
    <SettingsClient
      initialUser={{
        name: dbUser?.name || "",
        email: dbUser?.email || "",
        image: dbUser?.image || "",
      }}
      initialProviders={userProviderList.map((p) => ({
        ...p,
        modelList: Array.isArray(p.modelList) ? (p.modelList as any[]) : [],
        selectedModels: Array.isArray((p as any).selectedModels)
          ? ((p as any).selectedModels as string[])
          : [],
        updatedAt: String(p.updatedAt),
      }))}
      initialTools={userMcpTools}
      initialAgentMcpServers={agentMcpServers}
      initialAgentSkills={agentSkills}
    />
  )
}
