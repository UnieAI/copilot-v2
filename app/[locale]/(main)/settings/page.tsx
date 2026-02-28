import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { userProviders, mcpTools, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { SettingsMcpSection } from "@/components/settings/settings-mcp-section"
import { SettingsProvidersSection } from "@/components/settings/settings-providers-section"
import { ProfileForm } from "@/components/settings/profile-form"

export default async function SettingsPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId = session.user.id as string
    const dbUser = await db.query.users.findFirst({ where: eq(users.id, userId) })
    const userProviderList = await db.query.userProviders.findMany({ where: eq(userProviders.userId, userId) })
    const userMcpTools = await db.query.mcpTools.findMany({ where: eq(mcpTools.userId, userId) })

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 flex-shrink-0 border-b border-border/40 bg-background/95 backdrop-blur px-6 py-4 md:px-8">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl md:text-2xl font-medium tracking-tight">設定</h1>
                        <p className="text-sm text-muted-foreground mt-0.5 font-normal">管理您的個人資料、API Provider 與 MCP 工具</p>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-8 md:px-8">
                <div className="max-w-4xl mx-auto space-y-8 pb-12">
                    {/* Profile */}
                    <section className="space-y-4">
                        <div>
                            <h2 className="font-semibold">個人資料</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">更新您的顯示名稱</p>
                        </div>
                        <ProfileForm initialName={dbUser?.name || ""} />
                        <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t border-border">
                            <p>Email：{dbUser?.email}</p>
                            {/* <p>角色：{dbUser?.role}</p> */}
                            {/* <p>登入方式：{dbUser?.provider || '-'}</p> */}
                        </div>
                    </section>

                    {/* API Providers */}
                    <div className="pt-6 border-t border-border/40">
                        <SettingsProvidersSection
                            initialProviders={userProviderList.map(p => ({
                                ...p,
                                modelList: Array.isArray(p.modelList) ? p.modelList as any[] : [],
                                updatedAt: String(p.updatedAt),
                            }))}
                        />
                    </div>

                    {/* MCP Tools */}
                    <div className="pt-6 border-t border-border/40">
                        <SettingsMcpSection initialTools={userMcpTools} />
                    </div>
                </div>
            </div>
        </div>
    )
}
