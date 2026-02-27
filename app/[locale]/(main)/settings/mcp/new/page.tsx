import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { mcpTools } from "@/lib/db/schema"

export default async function NewMcpToolPage() {
    const session = await auth()
    if (!session || !session.user) redirect("/login")

    const addTool = async (formData: FormData) => {
        "use server"
        const session = await auth()
        if (!session || !session.user || !session.user.id) return

        const url = formData.get("url") as string
        const path = formData.get("path") as string
        const type = formData.get("type") as string
        const auth_type = formData.get("auth_type") as string
        const key = formData.get("key") as string
        const spec_type = formData.get("spec_type") as string
        const spec = formData.get("spec") as string
        const userId = session.user.id as string

        await db.insert(mcpTools).values({
            userId,
            url, path, type, auth_type, key, spec_type, spec,
            info: {}, config: {}
        })

        redirect("/settings")
    }

    return (
        <div className="p-8 max-w-2xl mx-auto h-full overflow-y-auto">
            <div className="flex items-center gap-4 mb-6">
                <a href="/settings" className="px-3 py-1 border rounded hover:bg-muted text-sm">&larr; Back</a>
                <h1 className="text-2xl font-bold">Add Custom MCP Tool</h1>
            </div>

            <form action={addTool} className="space-y-4 bg-muted/30 border p-6 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Base URL</label>
                        <input name="url" placeholder="https://api.example.com" className="w-full border rounded p-2 bg-background" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Path</label>
                        <input name="path" placeholder="/v1/execute" className="w-full border rounded p-2 bg-background" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Type</label>
                        <input name="type" placeholder="search, calculate..." className="w-full border rounded p-2 bg-background" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Auth Type</label>
                        <select name="auth_type" className="w-full border rounded p-2 bg-background">
                            <option value="none">None</option>
                            <option value="bearer">Bearer Token</option>
                            <option value="api-key">API Key (Header)</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">Auth Key (Optional)</label>
                        <input name="key" type="password" className="w-full border rounded p-2 bg-background" />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">Specification Type</label>
                        <select name="spec_type" className="w-full border rounded p-2 bg-background">
                            <option value="openapi">OpenAPI JSON</option>
                            <option value="prompt">System Prompt Instruction</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">Specification Content</label>
                        <textarea name="spec" rows={6} placeholder={`{ "openapi": "3.0.0", ... }`} className="w-full border rounded p-2 bg-background font-mono text-sm" required></textarea>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button type="submit" className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-medium">Add Tool Integration</button>
                </div>
            </form>
        </div>
    )
}
