"use client"

import { Check, ChevronDown, Loader2, Search, Settings2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AgentModelOption, AgentSelectedModel, AvailableModel } from "@/components/chat/types"
import { ModelItem } from "@/components/chat/agent-components"

type GroupEntry = {
  gName: string
  filtered: AvailableModel[]
  total: number
}

export function ChatHeader({
  chatMode,
  showSystemPrompt,
  onToggleSystemPrompt,
  systemPrompt,
  onSystemPromptChange,
  modelPickerOpen,
  onModelPickerOpenChange,
  modelSearch,
  onModelSearchChange,
  selectedModel,
  selectedModelObj,
  selectedModelLabel,
  filteredUserModels,
  filteredGlobalModels,
  groupEntries,
  hasAnyMatch,
  onNormalModelSelect,
  isSyncingModels,
}: {
  chatMode: "normal" | "agent"
  showSystemPrompt: boolean
  onToggleSystemPrompt: () => void
  systemPrompt: string
  onSystemPromptChange: (value: string) => void
  modelPickerOpen: boolean
  onModelPickerOpenChange: (open: boolean) => void
  modelSearch: string
  onModelSearchChange: (value: string) => void
  selectedModel: string
  selectedModelObj?: AvailableModel
  selectedModelLabel: string
  filteredUserModels: AvailableModel[]
  filteredGlobalModels: AvailableModel[]
  groupEntries: GroupEntry[]
  hasAnyMatch: boolean
  onNormalModelSelect: (value: string) => void
  isSyncingModels?: boolean
}) {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-10 shrink-0">
        <DropdownMenu
          open={modelPickerOpen && !isSyncingModels}
          onOpenChange={(open) => {
            if (isSyncingModels) return
            onModelPickerOpenChange(open)
            if (!open) onModelSearchChange("")
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              disabled={isSyncingModels}
              className={`flex items-center justify-between gap-3 px-4 py-2 min-w-[160px] max-w-[240px] rounded-full border border-border/40 bg-background/50 hover:bg-muted/50 transition-all duration-300 group outline-none disabled:opacity-60 disabled:cursor-not-allowed ${chatMode === "agent" ? "border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/30" : ""
                }`}
            >
              <div className="flex flex-col items-start text-left overflow-hidden">
                <span className={`text-[13px] font-semibold truncate w-full transition-colors leading-tight ${chatMode === "agent" ? "text-primary group-hover:text-primary/80" : "text-foreground/90 group-hover:text-primary"
                  }`}>
                  {isSyncingModels ? "同步模型中..." : selectedModelLabel}
                </span>
                {!isSyncingModels && selectedModelObj && (
                  <span className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-widest truncate w-full">
                    {selectedModelObj.providerName}
                  </span>
                )}
              </div>
              {isSyncingModels ? (
                <Loader2 className="h-4 w-4 text-muted-foreground/50 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-all duration-300 group-data-[state=open]:rotate-180" />
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            sideOffset={10}
            className="w-80 p-2 rounded-[24px] border-border/40 bg-background/80 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="relative mb-2 px-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              <input
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-muted/30 hover:bg-muted/50 focus:bg-background rounded-2xl border-none ring-1 ring-border/20 focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                placeholder="搜尋 AI 模型..."
                value={modelSearch}
                onChange={(e) => onModelSearchChange(e.target.value)}
              />
            </div>

            <div className="max-h-[420px] overflow-y-auto px-1 custom-scrollbar">
              {filteredUserModels.length > 0 && (
                <DropdownMenuGroup>
                  <div className="px-3 py-2 text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">
                    MY MODELS
                  </div>
                  <div className="space-y-0.5">
                    {filteredUserModels.map((m) => (
                      <ModelItem
                        key={m.value}
                        model={m}
                        isSelected={selectedModel === m.value}
                        onSelect={(val) => {
                          onNormalModelSelect(val)
                          onModelPickerOpenChange(false)
                        }}
                      />
                    ))}
                  </div>
                </DropdownMenuGroup>
              )}

              {filteredUserModels.length > 0 && (filteredGlobalModels.length > 0 || groupEntries.length > 0) && (
                <DropdownMenuSeparator className="my-2 bg-border/30 mx-2" />
              )}

              {filteredGlobalModels.length > 0 && (
                <DropdownMenuGroup>
                  <div className="px-3 py-2 text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">
                    GLOBAL PROVIDERS
                  </div>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="rounded-xl py-2.5 px-3 hover:bg-muted/50 focus:bg-muted/50 data-[state=open]:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex flex-col gap-0.5 text-left">
                        <span className="text-[13px] font-medium">All Global Models</span>
                        <span className="text-[10px] text-muted-foreground/60">{filteredGlobalModels.length} Models</span>
                      </div>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent
                        sideOffset={8}
                        className="w-64 p-2 rounded-[20px] bg-background/90 backdrop-blur-xl shadow-xl border-border/40"
                      >
                        <div className="max-h-[300px] overflow-y-auto space-y-0.5">
                          {filteredGlobalModels.map((m) => (
                            <ModelItem
                              key={m.value}
                              model={m}
                              isSelected={selectedModel === m.value}
                              onSelect={(val) => {
                                onNormalModelSelect(val)
                                onModelPickerOpenChange(false)
                              }}
                            />
                          ))}
                        </div>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                </DropdownMenuGroup>
              )}

              {filteredGlobalModels.length > 0 && groupEntries.length > 0 && (
                <DropdownMenuSeparator className="my-2 bg-border/30 mx-2" />
              )}
              {filteredUserModels.length > 0 && groupEntries.length > 0 && (
                <DropdownMenuSeparator className="my-2 bg-border/30 mx-2" />
              )}

              {groupEntries.length > 0 && (
                <DropdownMenuGroup>
                  <div className="px-3 py-2 text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">
                    GROUPS
                  </div>
                  <div className="space-y-0.5">
                    {groupEntries.map(({ gName, filtered }) => (
                      <DropdownMenuSub key={gName}>
                        <DropdownMenuSubTrigger className="rounded-xl py-2.5 px-3 hover:bg-muted/50 focus:bg-muted/50 data-[state=open]:bg-muted/50 transition-colors cursor-pointer">
                          <div className="flex flex-col gap-0.5 text-left">
                            <span className="text-[13px] font-medium">{gName}</span>
                            <span className="text-[10px] text-muted-foreground/60">{filtered.length} Models</span>
                          </div>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent
                            sideOffset={8}
                            className="w-64 p-2 rounded-[20px] bg-background/90 backdrop-blur-xl shadow-xl border-border/40"
                          >
                            <div className="max-h-[300px] overflow-y-auto space-y-0.5">
                              {filtered.map((m) => (
                                <ModelItem
                                  key={m.value}
                                  model={m}
                                  isSelected={selectedModel === m.value}
                                  onSelect={(val) => {
                                    onNormalModelSelect(val)
                                    onModelPickerOpenChange(false)
                                  }}
                                />
                              ))}
                            </div>
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                    ))}
                  </div>
                </DropdownMenuGroup>
              )}

              {!hasAnyMatch && (
                <div className="py-16 text-center animate-in fade-in slide-in-from-bottom-2">
                  <div className="inline-flex p-3 rounded-full bg-muted/30 mb-3">
                    <Search className="h-5 w-5 text-muted-foreground/30" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">找不到相關模型</p>
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={onToggleSystemPrompt}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <Settings2 className="h-4 w-4" />
          Prompt 設定
        </button>
      </div>

      {showSystemPrompt && (
        <div className="px-4 py-3 border-b border-border bg-muted/30 shrink-0">
          <textarea
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            placeholder="輸入 System Prompt（留空則不使用）..."
            rows={3}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}
    </>
  )
}
