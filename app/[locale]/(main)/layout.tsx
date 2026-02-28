import { Sidebar } from "@/components/sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { SetupChecker } from "@/components/setup-checker"

export default async function MainLayout({ children }: { children: React.ReactNode }) {
    const session = await auth()
    if (!session?.user) redirect('/login')

    const userRole = (session.user as any).role as string ?? "user"

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-muted/20 dark:bg-background/95">
            <SidebarProvider defaultOpen={true}>
                <Sidebar />
                <main className="flex-1 h-full overflow-hidden flex flex-col relative w-[calc(100vw-min(var(--sidebar-width,256px),100vw))] min-w-0 p-2 md:p-3 md:pl-0">
                    <div className="flex-1 rounded-[24px] bg-background dark:bg-muted/10 border border-border/40 shadow-sm overflow-hidden flex flex-col relative">
                        {children}
                    </div>
                </main>
            </SidebarProvider>
            <SetupChecker userRole={userRole} />
        </div>
    )
}

