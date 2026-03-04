"use client"

import type { ClipboardEvent, KeyboardEvent, RefObject } from "react"
import { Loader2, Paperclip, Send, X } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { AttachmentThumbnail } from "@/components/chat/attachment-thumbnail"
import type { Attachment } from "@/components/chat/types"
import { ACCEPTED_DOC_TYPES, ACCEPTED_IMAGE_TYPES } from "@/components/chat/utils"

type ChatMode = "normal" | "agent"

export function ChatComposer({
  hasRightPanel,
  attachments,
  input,
  isGenerating,
  isSetupBlocked,
  isSyncingModels,
  chatMode,
  textareaRef,
  fileInputRef,
  onInputChange,
  onInputPaste,
  onInputKeyDown,
  onHandleFileSelect,
  onOpenAttachmentPreview,
  onRemoveAttachment,
  onToggleMode,
  onStopGeneration,
  onSubmit,
}: {
  hasRightPanel: boolean
  attachments: Attachment[]
  input: string
  isGenerating: boolean
  isSetupBlocked: boolean
  isSyncingModels: boolean
  chatMode: ChatMode
  textareaRef: RefObject<HTMLTextAreaElement>
  fileInputRef: RefObject<HTMLInputElement>
  onInputChange: (value: string) => void
  onInputPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void
  onInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onHandleFileSelect: (files: FileList | null) => void
  onOpenAttachmentPreview: (attachment: Attachment) => void
  onRemoveAttachment: (index: number) => void
  onToggleMode: (mode: ChatMode) => void
  onStopGeneration: () => void
  onSubmit: () => void
}) {
  return (
    <div className="bg-background px-4 py-4 shrink-0">
      <div
        className={`relative mx-auto flex flex-col rounded-[24px] bg-muted/30 transition-all shadow-sm
          border border-border/80 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 focus-within:bg-background
          hover:border-primary/30
          ${hasRightPanel ? "max-w-full" : "max-w-3xl"}`}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-5 pt-4 pb-0">
            {attachments.map((att, i) => (
              <AttachmentThumbnail
                key={i}
                attachment={att}
                onRemove={() => onRemoveAttachment(i)}
                onClick={() => onOpenAttachmentPreview(att)}
              />
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={input}
          onPaste={onInputPaste}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={isSyncingModels ? "正在同步模型設定..." : "輸入訊息或拖曳檔案/圖片至此處... (Shift+Enter 換行)"}
          disabled={isGenerating || isSetupBlocked || isSyncingModels}
          rows={1}
          className={`w-full resize-none bg-transparent px-5 py-4 text-[15px] leading-relaxed focus:outline-none placeholder:text-muted-foreground disabled:opacity-50 min-h-[56px] max-h-[30vh] overflow-y-auto scrollbar-hide ${attachments.length > 0 ? "pt-3" : ""}`}
        />

        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept={`${ACCEPTED_IMAGE_TYPES},${ACCEPTED_DOC_TYPES}`}
              onChange={(e) => {
                onHandleFileSelect(e.target.files)
                e.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isGenerating || isSyncingModels}
              className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
              title="附加圖片或文件"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 px-2.5 py-1.5">
              <span className={`text-[11px] font-medium ${chatMode === "normal" ? "text-foreground" : "text-muted-foreground"}`}>一般</span>
              <Switch
                checked={chatMode === "agent"}
                onCheckedChange={(checked) => onToggleMode(checked ? "agent" : "normal")}
                disabled={isGenerating || isSyncingModels}
                aria-label="切換對話模式"
              />
              <span className={`text-[11px] font-medium ${chatMode === "agent" ? "text-foreground" : "text-muted-foreground"}`}>Agent</span>
            </div>
          </div>

          {isGenerating ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="mr-1 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md transition-all duration-200 hover:scale-105 hover:bg-primary/90 active:scale-95"
              title="暫停生成"
              aria-label="暫停生成"
            >
              <X className="h-4 w-4" />
            </button>
          ) : isSyncingModels ? (
            <button
              type="button"
              disabled
              className="mr-1 flex items-center justify-center gap-1.5 rounded-full px-4 py-2 bg-muted text-muted-foreground opacity-70 transition-all duration-200 cursor-not-allowed"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs font-medium">同步模型中</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={(!input.trim() && attachments.length === 0) || isSyncingModels}
              title="送出"
              className={`mr-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2.5 transition-all duration-200
                ${(!input.trim() && attachments.length === 0)
                  ? "bg-muted/80 text-muted-foreground"
                  : "bg-primary text-primary-foreground shadow-md transform hover:scale-105 hover:bg-primary/90 active:scale-95"
                } disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none`}
            >
              <Send className="h-5 w-5 pl-0.5" />
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground/50 text-center mt-3 font-medium">AI 助手可能會產生錯誤資訊，請小心查證。</p>
    </div>
  )
}
