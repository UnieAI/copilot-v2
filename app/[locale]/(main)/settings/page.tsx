import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { userModels, mcpTools, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export default async function SettingsPage() {
    const session = await auth()
    if (!session || !session.user || !session.user.id) redirect("/login")

    const userId = session.user.id as string
    const dbUser = await db.query.users.findFirst({ where: eq(users.id, userId) })
    const userModelConf = await db.query.userModels.findFirst({ where: eq(userModels.userId, userId) })
    const userMcpTools = await db.query.mcpTools.findMany({ where: eq(mcpTools.userId, userId) })

    // Actions
    const saveProfile = async (formData: FormData) => {
        "use server"
        const session = await auth()
        if (!session || !session.user || !session.user.id) return
        const userId = session.user.id as string
        const name = formData.get("name") as string
        await db.update(users).set({ name }).where(eq(users.id, userId))
        revalidatePath("/settings")
    }

    const saveModels = async (formData: FormData) => {
        "use server"
        const session = await auth()
        if (!session || !session.user || !session.user.id) return
        const userId = session.user.id as string
        const apiUrl = formData.get("apiUrl") as string
        const apiKey = formData.get("apiKey") as string

        try {
            const cleanUrl = apiUrl.replace(/\/+$/, '');
            const targetUrl = cleanUrl.endsWith('/v1') ? `${cleanUrl}/models` : `${cleanUrl}/v1/models`;

            const res = await fetch(targetUrl, {
                headers: { "Authorization": `Bearer ${apiKey}` }
            })
            const data = await res.json()
            const models = Array.isArray(data.data) ? data.data : []

            const existing = await db.query.userModels.findFirst({ where: eq(userModels.userId, userId) })
            if (existing) {
                await db.update(userModels).set({ apiUrl, apiKey, modelList: models }).where(eq(userModels.userId, userId))
            } else {
                await db.insert(userModels).values({ userId, apiUrl, apiKey, modelList: models })
            }
        } catch (e) {
            console.error("Failed to fetch models", e)
            throw new Error("Failed to connect to API")
        }
        revalidatePath("/settings")
    }

    const deleteMcpTool = async (formData: FormData) => {
        "use server"
        const session = await auth()
        if (!session || !session.user || !session.user.id) return
        const toolId = formData.get("toolId") as string
        await db.delete(mcpTools).where(eq(mcpTools.id, toolId))
        revalidatePath("/settings")
    }

    return (
        <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto">
            <h1 className="text-3xl font-bold mb-6">Settings</h1>

            {/* Very simple non-interactive tab layout for MVP (Can be upgraded to Radix Tabs later) */}
            <div className="flex flex-col gap-8">
                {/* Profile Section */}
                <section className="border p-6 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">Profile</h2>
                    <form action={saveProfile} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Display Name</label>
                            <input name="name" defaultValue={dbUser?.name || ""} className="w-full border rounded p-2 bg-background" />
                        </div>
                        <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded">Save Profile</button>
                    </form>
                </section>

                {/* API Models Section */}
                <section className="border p-6 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">AI Models Configuration</h2>
                    <p className="text-sm text-muted-foreground mb-4">Provide an OpenAI-compatible API. The URL must include the /v1 suffix (e.g. https://api.openai.com/v1). We will fetch available models automatically.</p>
                    <form action={saveModels} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">API Base URL (must end in /v1)</label>
                                <input name="apiUrl" placeholder="https://api.openai.com/v1" defaultValue={userModelConf?.apiUrl || ""} className="w-full border rounded p-2 bg-background" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">API Key</label>
                                <input name="apiKey" type="password" placeholder="sk-..." defaultValue={userModelConf?.apiKey || ""} className="w-full border rounded p-2 bg-background" required />
                            </div>
                        </div>
                        <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded">Sync Models</button>
                    </form>

                    {userModelConf && (
                        <div className="mt-4 p-4 bg-muted rounded">
                            <h3 className="font-medium text-sm mb-2">Synced Models ({Array.isArray(userModelConf.modelList) ? userModelConf.modelList.length : 0})</h3>
                            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                                {Array.isArray(userModelConf.modelList) && userModelConf.modelList.map((m: any) => (
                                    <span key={m.id} className="text-xs bg-background border px-2 py-1 rounded">{m.id}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* MCP Tools Section */}
                <section className="border p-6 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">MCP Tools</h2>
                        {/* Placeholder for Add Tool form/modal */}
                        <a href="/settings/mcp/new" className="bg-primary text-primary-foreground px-3 py-1 text-sm rounded cursor-pointer">Add Tool</a>
                    </div>

                    {userMcpTools.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No MCP Tools configured.</p>
                    ) : (
                        <ul className="space-y-2">
                            {userMcpTools.map(tool => (
                                <li key={tool.id} className="border p-3 rounded flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">{tool.type} - {tool.url}</p>
                                        <p className="text-xs text-muted-foreground">{tool.path}</p>
                                    </div>
                                    <form action={deleteMcpTool}>
                                        <input type="hidden" name="toolId" value={tool.id} />
                                        <button type="submit" className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                                    </form>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    )
}
