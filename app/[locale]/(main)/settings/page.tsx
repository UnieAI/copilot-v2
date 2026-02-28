import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { userModels, mcpTools, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { SettingsMcpSection } from "@/components/settings/settings-mcp-section"

export default async function SettingsPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId = session.user.id as string
    const dbUser = await db.query.users.findFirst({ where: eq(users.id, userId) })
    const userModelConf = await db.query.userModels.findFirst({ where: eq(userModels.userId, userId) })
    const userMcpTools = await db.query.mcpTools.findMany({ where: eq(mcpTools.userId, userId) })

    const saveProfile = async (formData: FormData) => {
        "use server"
        const session = await auth()
        if (!session?.user?.id) return
        const name = formData.get("name") as string
        await db.update(users).set({ name }).where(eq(users.id, session.user.id as string))
        revalidatePath("/settings")
    }

    const saveModels = async (formData: FormData) => {
        "use server"
        const session = await auth()
        if (!session?.user?.id) return
        const uid = session.user.id as string
        const apiUrl = formData.get("apiUrl") as string
        const apiKey = formData.get("apiKey") as string
        try {
            const cleanUrl = apiUrl.replace(/\/+$/, '')
            const targetUrl = cleanUrl.endsWith('/v1') ? `${cleanUrl}/models` : `${cleanUrl}/v1/models`
            const res = await fetch(targetUrl, { headers: { "Authorization": `Bearer ${apiKey}` } })
            const data = await res.json()
            const models = Array.isArray(data.data) ? data.data : []
            const existing = await db.query.userModels.findFirst({ where: eq(userModels.userId, uid) })
            if (existing) {
                await db.update(userModels).set({ apiUrl, apiKey, modelList: models }).where(eq(userModels.userId, uid))
            } else {
                await db.insert(userModels).values({ userId: uid, apiUrl, apiKey, modelList: models })
            }
        } catch {
            throw new Error("無法連接 API，請確認 URL 和 Key 是否正確")
        }
        revalidatePath("/settings")
    }

    const modelList = userModelConf && Array.isArray(userModelConf.modelList)
        ? (userModelConf.modelList as any[])
        : []

    return (
        <div className="p-6 max-w-3xl mx-auto h-full overflow-y-auto space-y-6">
            <div>
                <h1 className="text-2xl font-semibold">設定</h1>
                <p className="text-sm text-muted-foreground mt-1">管理您的個人資料、API 模型與 MCP 工具</p>
            </div>

            {/* Profile */}
            <section className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div>
                    <h2 className="font-semibold">個人資料</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">更新您的顯示名稱</p>
                </div>
                <form action={saveProfile} className="flex gap-3">
                    <input name="name" defaultValue={dbUser?.name || ""} placeholder="您的名稱"
                        className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button type="submit" className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">儲存</button>
                </form>
                <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t border-border">
                    <p>Email：{dbUser?.email}</p>
                    <p>角色：{dbUser?.role}</p>
                    <p>登入方式：{dbUser?.provider || '-'}</p>
                </div>
            </section>

            {/* API Models */}
            <section className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div>
                    <h2 className="font-semibold">API 模型設定</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">設定您的 OpenAI 相容 API，URL 需包含 /v1 後綴</p>
                </div>
                <form action={saveModels} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium">API URL（含 /v1）</label>
                            <input name="apiUrl" placeholder="https://api.openai.com/v1" defaultValue={userModelConf?.apiUrl || ""}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium">API Key</label>
                            <input name="apiKey" type="password" placeholder="sk-..." defaultValue={userModelConf?.apiKey || ""}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                required
                            />
                        </div>
                    </div>
                    <button type="submit" className="h-9 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors">
                        同步模型列表
                    </button>
                </form>

                {modelList.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">已同步模型 ({modelList.length})</p>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                            {modelList.map((m: any) => (
                                <span key={m.id || String(m)} className="text-xs bg-muted border border-border px-2 py-0.5 rounded-full">{m.id || String(m)}</span>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* MCP Tools — client component with Dialog */}
            <SettingsMcpSection initialTools={userMcpTools} />
        </div>
    )
}
