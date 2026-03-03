"use client"

import { useState } from "react"
import * as Tabs from "@radix-ui/react-tabs"
import { ProfileForm } from "@/components/settings/profile-form"
import { SettingsProvidersSection } from "@/components/settings/settings-providers-section"
import { SettingsMcpSection } from "@/components/settings/settings-mcp-section"

interface Props {
  initialUser: {
    name: string
    email: string
    // role?: string
  }
  initialProviders: any[] // 根據你的實際型別調整
  initialTools: any[]     // 根據你的實際型別調整
}

export default function SettingsClient({
  initialUser,
  initialProviders,
  initialTools,
}: Props) {
  const [activeTab, setActiveTab] = useState("profile")

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex-shrink-0 border-b border-border/40 bg-background/95 backdrop-blur px-6 py-4 md:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-medium tracking-tight">設定</h1>
            <p className="text-sm text-muted-foreground mt-0.5 font-normal">
              管理您的個人資料、API Provider 與 MCP 工具
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8 md:px-8">
        <div className="max-w-4xl mx-auto pb-12">
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List className="flex border-b border-border mb-8 sticky top-0 bg-background/90 backdrop-blur-sm z-10">
              <Tabs.Trigger
                value="profile"
                className="px-6 py-3 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors"
              >
                使用者基本資料
              </Tabs.Trigger>
              <Tabs.Trigger
                value="providers"
                className="px-6 py-3 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors"
              >
                私人 Providers
              </Tabs.Trigger>
              <Tabs.Trigger
                value="mcp"
                className="px-6 py-3 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors"
              >
                MCP Tools
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="profile" className="space-y-8">
              <section className="space-y-4">
                <div>
                  <h2 className="font-semibold">個人資料</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">更新您的顯示名稱</p>
                </div>
                <ProfileForm initialName={initialUser.name} />
                <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t border-border">
                  <p>Email：{initialUser.email}</p>
                  {/* <p>角色：{initialUser.role || "—"}</p> */}
                </div>
              </section>
            </Tabs.Content>

            <Tabs.Content value="providers">
              <SettingsProvidersSection initialProviders={initialProviders} />
            </Tabs.Content>

            <Tabs.Content value="mcp">
              <SettingsMcpSection initialTools={initialTools} />
            </Tabs.Content>
          </Tabs.Root>
        </div>
      </div>
    </div>
  )
}