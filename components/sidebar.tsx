"use client"

import { usePathname } from "next/navigation"

export function Sidebar() {
    const pathname = usePathname()

    // Very simple sidebar
    return (
        <aside className="w-64 bg-muted/20 border-r h-full flex flex-col p-4">
            <h2 className="font-bold text-lg mb-8 px-2 max-[768px]:hidden text-primary">UnieAI</h2>

            <nav className="flex-1 space-y-2">
                <a href="/" className={`block px-3 py-2 rounded-md ${pathname === "/" || pathname?.includes("/chat") ? "bg-accent" : "hover:bg-accent/50"}`}>Chat</a>
                <a href="/settings" className={`block px-3 py-2 rounded-md ${pathname?.includes("/settings") ? "bg-accent" : "hover:bg-accent/50"}`}>Settings</a>
            </nav>

            <div className="mt-auto space-y-2 border-t pt-4">
                <a href="/admin/users" className={`block px-3 py-2 text-sm rounded-md ${pathname?.includes("/admin/users") ? "bg-accent" : "hover:bg-accent/50"}`}>Users (Admin)</a>
                <a href="/admin/settings" className={`block px-3 py-2 text-sm rounded-md ${pathname?.includes("/admin/settings") ? "bg-accent" : "hover:bg-accent/50"}`}>System (Admin)</a>
            </div>
        </aside>
    )
}
