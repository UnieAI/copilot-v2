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
        <div className="h-full flex flex-col bg-background/50">
            {/* --- Gemini Style Sticky Header --- */}
            <div className="sticky top-0 z-20 flex-shrink-0 border-b border-border/20 bg-background/60 backdrop-blur-xl px-6 py-5 md:px-12">
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                        系統設定
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1.5 font-medium">
                        調整全站核心參數與 AI 模型供應鏈
                    </p>
                </div>
            </div>

            {/* --- Scrollable Content --- */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-5xl mx-auto px-6 py-10 md:px-12">
                    <AdminSettingsForm settings={settings} />
                </div>
            </div>
        </div>
    )
}