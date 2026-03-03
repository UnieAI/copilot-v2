import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { userProviders, mcpTools, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import SettingsClient from "@/components/settings/settings-client"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id as string

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  const userProviderList = await db.query.userProviders.findMany({
    where: eq(userProviders.userId, userId),
  })

  const userMcpTools = await db.query.mcpTools.findMany({
    where: eq(mcpTools.userId, userId),
  })

  return (
    <SettingsClient
      initialUser={{
        name: dbUser?.name || "",
        email: dbUser?.email || "",
        image: dbUser?.image || "",
        // role: dbUser?.role,        // 如果之後要顯示可以取消註解
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
    />
  )
}
