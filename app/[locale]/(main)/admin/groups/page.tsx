import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AdminGroupsListPanel } from "@/components/admin/groups-list-panel"

export default async function AdminGroupsPage() {
    const session = await auth()
    const myRole = (session?.user as any)?.role as string
    if (!session?.user || !["admin", "super"].includes(myRole)) redirect("/")

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 flex-shrink-0 border-b border-border/40 bg-background/95 backdrop-blur px-6 py-4 md:px-8">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-xl md:text-2xl font-medium tracking-tight">群組管理</h1>
                    <p className="text-sm text-muted-foreground mt-0.5 font-normal">
                        建立群組並指派成員。點擊群組名稱進入群組詳情頁進行完整設定。
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
                <div className="max-w-4xl mx-auto">
                    <AdminGroupsListPanel />
                </div>
            </div>
        </div>
    )
}
