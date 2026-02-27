"use client"

import type * as React from "react"
import { useEffect, useState } from "react"
import { MessageCircle, Users, Settings, Home, Search, HelpCircle, MessagesSquare, Venus, Shirt } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Label } from "@/components/ui/label"
import { ModeToggle } from "@/components/mode-toggle"
import Dick from "./icon/dick"
import { NavUser } from "./nav-user"
import { Session } from "next-auth"
import { ActionGetUserImgByEmail } from "@/app/(main)/actions"
import { useSession } from "next-auth/react"

// 主要導航項目
const navMain = [
  {
    title: "角色聊天室",
    url: "/chat-room",
    icon: MessagesSquare,
  },
  {
    title: "簡易聊天室",
    url: "/simple-chat-room",
    icon: MessageCircle,
  },
]

const navGame = [

]

// 工具和設定
const navSettings = [
  {
    title: "角色管理",
    url: "/character",
    icon: Users,
  },
  {
    title: "設定",
    url: "/settings",
    icon: Settings,
  },
  {
    title: "幫助",
    url: "/help",
    icon: HelpCircle,
  },
]

type AppSidebarProps = {

} & React.ComponentProps<typeof Sidebar>;

type UserState = {
  name: string;
  email: string;
  avatar: string;
};

export function AppSidebar({ ...props }: AppSidebarProps) {
  const { data: session } = useSession();

  const [user, setUser] = useState<UserState>({
    name: '',
    email: '',
    avatar: '/system/default-avatar.png',
  });

  useEffect(() => {
    if (!session?.user?.email) return;

    const getImg = async () => {
      const img = await ActionGetUserImgByEmail({
        email: session.user!.email,
      });

      setUser(prev => ({
        ...prev,
        name: session.user.username ?? '',
        email: session.user.email ?? '',
        avatar: img.image ?? '/static/logo.png',
      }));
    };

    getImg();
  }, [session]);

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-purple-600 text-sidebar-primary-foreground">
                  <MessageCircle className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Multi AI Chatroom</span>
                  <span className="truncate text-xs">智能對話平台</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <form>
          <SidebarGroup className="py-0">
            <SidebarGroupContent className="relative">
              <Label htmlFor="search" className="sr-only">
                搜索
              </Label>
              <SidebarInput id="search" placeholder="搜索功能..." className="pl-8" />
              <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 select-none opacity-50" />
            </SidebarGroupContent>
          </SidebarGroup>
        </form>
      </SidebarHeader>

      <SidebarContent>
        {/* 主要功能 */}
        <SidebarGroup>
          <SidebarGroupLabel>主要功能</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 遊戲區域 */}
        <SidebarGroup>
          <SidebarGroupLabel>遊戲區域</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navGame.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 工具和設定 */}
        <SidebarGroup>
          <SidebarGroupLabel>工具和設定</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navSettings.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {/* <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between p-2">
              <span className="text-sm font-medium">主題設定</span>
              <ModeToggle />
            </div>
          </SidebarMenuItem>
        </SidebarMenu> */}
        <NavUser user={user} session={session} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
