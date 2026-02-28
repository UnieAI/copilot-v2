import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { adminSettings } from "@/lib/db/schema"
import { signOut } from "@/auth"
import { Clock } from "lucide-react"

export default async function PendingPage() {
    const session = await auth()
    if (!session?.user) redirect('/login')
    if ((session.user as any).role !== 'pending') redirect('/')

    const settings = await db.query.adminSettings.findFirst()
    const message = settings?.pendingMessage || "您的帳號正在等待管理員審核，請稍後再試。"

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md space-y-6 text-center">
                <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <Clock className="h-8 w-8 text-muted-foreground" />
                    </div>
                </div>
                <div>
                    <h1 className="text-2xl font-semibold">等待審核中</h1>
                    <p className="mt-2 text-muted-foreground text-sm">{message}</p>
                </div>

                <div className="rounded-lg border border-border bg-card p-4 text-left text-sm space-y-1">
                    <p className="font-medium">{session.user.name}</p>
                    <p className="text-muted-foreground">{session.user.email}</p>
                </div>

                <form action={async () => {
                    "use server"
                    await signOut({ redirectTo: '/login' })
                }}>
                    <button type="submit" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
                        登出
                    </button>
                </form>
            </div>
        </div>
    )
}
