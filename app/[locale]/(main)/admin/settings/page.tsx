import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import AdminSettingsClient from "@/components/admin/settings/admin-settings-client"

export default async function AdminSettingsPage() {
    const session = await auth()
    if (!session || !session.user || ((session.user as any).role !== 'admin' && (session.user as any).role !== 'super')) {
        redirect("/")
    }

    const settings = await db.query.adminSettings.findFirst()

    return <AdminSettingsClient initialSettings={settings} />
}
