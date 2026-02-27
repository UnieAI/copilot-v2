"use client"

import {
    ChevronsUpDown,
    LogOut,
    Moon,
    SunMedium,
    SunMoon,
    Languages,
    LogIn,
    Check,
    Laptop,
    Globe
} from "lucide-react"

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"
import { Session } from "next-auth"
import { useEffect } from "react"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { isDevelopment } from "@/utils"
import { useTranslations, useLocale } from "next-intl"
import Link from "next/link"
import { cn } from "@/lib/utils"

export const NavUser = ({
    user,
    session
}: {
    user: {
        name: string
        email: string
        avatar: string
    },
    session: Session | null
}) => {
    const { isMobile } = useSidebar()
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        if (isDevelopment) console.log(session)
    }, [session?.user.username]);

    // Helper to render the checkmark if active
    const CheckIcon = ({ active }: { active: boolean }) => {
        if (!active) return null;
        return <Check className="ml-auto h-4 w-4 text-blue-500" />;
    };

    // Helper for Menu Items to ensure consistent styling
    const MenuItem = ({
        active,
        icon: Icon,
        label,
        onClick
    }: {
        active: boolean,
        icon: any,
        label: string,
        onClick: () => void
    }) => (
        <DropdownMenuItem
            onClick={onClick}
            className={cn(
                "flex items-center justify-between gap-2 cursor-pointer",
                active ? "bg-accent text-accent-foreground font-medium" : ""
            )}
        >
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{label}</span>
            </div>
            <CheckIcon active={active} />
        </DropdownMenuItem>
    );

    // If no session, show Login button
    if (!session) {
        return (
            <SidebarMenu>
                <SidebarMenuItem>
                    <Link href="/login">
                        <SidebarMenuButton size="lg" className="w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                <LogIn className="size-4" />
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">login</span>
                                <span className="truncate text-xs text-muted-foreground">Access your account</span>
                            </div>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
            </SidebarMenu>
        );
    }

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-all duration-200"
                        >
                            <Avatar className="h-8 w-8 rounded-lg ring-1 ring-border">
                                <AvatarImage src={user.avatar} alt={session?.user.name || ""} className="" />
                                <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-medium">
                                    {user.name?.substring(0, 2).toUpperCase() || "CN"}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">{session?.user.name}</span>
                                <span className="truncate text-xs text-muted-foreground">{session?.user.email}</span>
                            </div>
                            <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl border border-border/50 bg-popover/95 backdrop-blur-sm shadow-xl"
                        side={isMobile ? "bottom" : "right"}
                        align="end"
                        sideOffset={8}
                    >
                        <DropdownMenuGroup>
                            {/* Theme Submenu */}
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="gap-2">
                                    <SunMoon className="h-4 w-4 text-muted-foreground" />
                                    <span>主題設定</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="min-w-40 rounded-lg shadow-lg">
                                        <MenuItem
                                            active={theme === 'light'}
                                            icon={SunMedium}
                                            label='明亮模式'
                                            onClick={() => setTheme("light")}
                                        />
                                        <MenuItem
                                            active={theme === 'dark'}
                                            icon={Moon}
                                            label='深色模式'
                                            onClick={() => setTheme("dark")}
                                        />
                                        <MenuItem
                                            active={theme === 'system'}
                                            icon={Laptop}
                                            label='跟隨系統'
                                            onClick={() => setTheme("system")}
                                        />
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>

                        </DropdownMenuGroup>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={() => signOut()} className="text-red-500 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer">
                            <LogOut className="mr-2 h-4 w-4" />
                            {'logout'}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
    >
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
);
