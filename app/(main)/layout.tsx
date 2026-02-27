import { auth } from "../(auth)/auth"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar";
import { redirect } from "next/navigation";

export default async function Layout(
  { children }: { children: React.ReactNode }
) {
  const session = await auth();

  if (!session) {
    return redirect('/login')
  }

  return (
    <SidebarProvider >
      <AppSidebar />
      <SidebarInset>

        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 justify-between md:hidden">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            Multi AI Chatroom
          </div>
        </header>
        <div className="flex flex-1 flex-col p-0 md:p-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}