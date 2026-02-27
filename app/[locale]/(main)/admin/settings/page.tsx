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
        <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto">
            <h1 className="text-3xl font-bold mb-6">System Settings</h1>
            <AdminSettingsForm settings={settings} />
        </div>
    )
}
