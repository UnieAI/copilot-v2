"use client"

import { FileText, X } from "lucide-react"
import { useAttachmentPreviewSrc } from "./utils"
import type { Attachment } from "./types"

export function FilePreviewSidebar({ attachment, onClose }: { attachment: Attachment, onClose: () => void }) {
    const isImage = attachment.mimeType.startsWith('image/')
    const imgSrc = useAttachmentPreviewSrc(attachment)

    return (
        <div className="w-1/2 min-w-[300px] border-l border-border bg-card flex flex-col h-full animate-in slide-in-from-right-8 duration-300 relative z-20 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border bg-background">
                <div className="flex flex-col overflow-hidden px-2">
                    <p className="text-sm font-semibold truncate" title={attachment.name}>{attachment.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{attachment.mimeType}</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors shrink-0">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/20">
                {isImage && imgSrc ? (
                    <img src={imgSrc} alt={attachment.name} className="max-w-full max-h-full rounded-md shadow-sm border border-border object-contain" />
                ) : attachment.mimeType === 'application/pdf' ? (
                    <iframe src={imgSrc} className="w-full h-full rounded-md border border-border bg-white" title={attachment.name} />
                ) : (
                    <div className="text-center p-8 bg-background border border-border shadow-sm rounded-xl max-w-sm">
                        <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="text-sm font-medium mb-1 truncate">{attachment.name}</h3>
                        <p className="text-xs text-muted-foreground mb-4">無法在瀏覽器中直接預覽此格式 ({attachment.mimeType})</p>
                        {imgSrc && (
                            <a href={imgSrc} download={attachment.name} className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors bg-primary text-primary-foreground rounded-md shadow hover:bg-primary/90">
                                下載檔案
                            </a>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
