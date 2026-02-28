import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AdminSettingsForm } from "./admin-settings-form"

export default async function AdminSettingsPage() {
    const session = await auth()
    if (!session || !session.user || ((session.user as any).role !== 'admin' && (session.user as any).role !== 'super')) {
        redirect("/")
    }

    const settings = await db.query.adminSettings.findFirst()

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 flex-shrink-0 border-b border-border/40 bg-background/95 backdrop-blur px-6 py-4 md:px-8">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl md:text-2xl font-medium tracking-tight">系統設定</h1>
                        <p className="text-sm text-muted-foreground mt-0.5 font-normal">管理全站行為與預設 AI 模型</p>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-8 md:px-8">
                <div className="max-w-4xl mx-auto">
                    <AdminSettingsForm settings={settings} />
                </div>
            </div>
        </div>
    )
}
