import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { userModels, mcpTools, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import Link from "next/link"

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

    const deleteMcpTool = async (formData: FormData) => {
        "use server"
        const toolId = formData.get("toolId") as string
        await db.delete(mcpTools).where(eq(mcpTools.id, toolId))
        revalidatePath("/settings")
    }

    const toggleMcpTool = async (formData: FormData) => {
        "use server"
        const toolId = formData.get("toolId") as string
        const isActive = formData.get("isActive") === '1' ? 0 : 1
        await db.update(mcpTools).set({ isActive }).where(eq(mcpTools.id, toolId))
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

            {/* MCP Tools */}
            <section className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="font-semibold">MCP 工具</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">管理 AI 可調用的外部工具</p>
                    </div>
                    <Link href="/settings/mcp/new"
                        className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted transition-colors"
                    >
                        + 新增工具
                    </Link>
                </div>

                {userMcpTools.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                        尚未新增任何 MCP 工具
                    </div>
                ) : (
                    <div className="space-y-2">
                        {userMcpTools.map(tool => (
                            <div key={tool.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                                <span className="text-muted-foreground shrink-0 text-sm">🔗</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{(tool.info as any)?.title || tool.url}</p>
                                    <p className="text-xs text-muted-foreground truncate">{tool.type} · {tool.path}</p>
                                </div>
                                <form action={toggleMcpTool}>
                                    <input type="hidden" name="toolId" value={tool.id} />
                                    <input type="hidden" name="isActive" value={String(tool.isActive)} />
                                    <button type="submit"
                                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${tool.isActive ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 'bg-muted text-muted-foreground border-border'}`}
                                    >
                                        {tool.isActive ? '啟用' : '停用'}
                                    </button>
                                </form>
                                <form action={deleteMcpTool}>
                                    <input type="hidden" name="toolId" value={tool.id} />
                                    <button type="submit" className="p-1 text-muted-foreground hover:text-destructive transition-colors text-sm">
                                        🗑
                                    </button>
                                </form>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
