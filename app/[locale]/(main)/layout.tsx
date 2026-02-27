import { Sidebar } from "@/components/sidebar"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function MainLayout({ children }: { children: React.ReactNode }) {
    const session = await auth()
    if (!session || !session.user) redirect('/login')

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-background">
            <Sidebar />
            <main className="flex-1 h-full overflow-hidden flex flex-col relative w-full">
                {children}
            </main>
        </div>
    )
}
