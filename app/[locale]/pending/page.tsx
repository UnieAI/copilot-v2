import { auth } from "@/auth"
import { db } from "@/lib/db"
import { adminSettings } from "@/lib/db/schema"
import { redirect } from "next/navigation"

export default async function PendingPage() {
    const session = await auth()
    if (!session || !session.user) {
        redirect("/login")
    }

    if (session.user.role !== 'pending') {
        redirect("/")
    }

    const settings = await db.query.adminSettings.findFirst()
    const pendingMessage = settings?.pendingMessage || "Your account is pending administrator approval."

    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground">
            <h1 className="text-4xl font-bold mb-4">Pending Approval</h1>
            <p className="text-lg text-muted-foreground text-center max-w-md">
                {pendingMessage}
            </p>
        </div>
    )
}
