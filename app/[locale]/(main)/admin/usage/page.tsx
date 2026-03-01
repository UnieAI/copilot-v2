import { auth } from "@/auth"
import { redirect } from "next/navigation"
import PlatformUsage from "@/components/admin/platform-usage"

export default async function AdminUsagePage() {
    const session = await auth()
    const role = (session?.user as any)?.role as string
    if (!session?.user || !["admin", "super"].includes(role)) redirect("/")

    return (
        <div className="h-full flex flex-col overflow-hidden px-6 py-6 md:px-8">
            <PlatformUsage />
        </div>
    )
}
