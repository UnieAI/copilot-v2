import { FileText, X } from "lucide-react"
import { useState, useEffect } from "react"
import type { Attachment } from "./types"

export function AttachmentThumbnail({ attachment, onRemove, onClick }: {
    attachment: Attachment
    onRemove?: () => void
    onClick?: () => void
}) {
    const isImage = attachment.mimeType.startsWith('image/')
    const isPdf = attachment.mimeType === 'application/pdf'
    const imgSrc = attachment.previewUrl || (attachment.base64 ? `data:${attachment.mimeType};base64,${attachment.base64}` : undefined)

    // We need useEffect to convert base64 PDFs into Blob URLs
    // Browsers block data:application/pdf base64 strings in iframes for security
    const [objectUrl, setObjectUrl] = useState<string | null>(null)

    useEffect(() => {
        let url = ""
        if (attachment.previewUrl) {
            url = attachment.previewUrl
            setObjectUrl(url)
        } else if (attachment.base64) {
            if (isPdf) {
                try {
                    const byteCharacters = atob(attachment.base64)
                    const byteNumbers = new Array(byteCharacters.length)
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i)
                    }
                    const byteArray = new Uint8Array(byteNumbers)
                    const blob = new Blob([byteArray], { type: 'application/pdf' })
                    url = URL.createObjectURL(blob)
                    setObjectUrl(url)
                } catch (e) {
                    // Fallback
                    url = `data:${attachment.mimeType};base64,${attachment.base64}`
                    setObjectUrl(url)
                }
            } else {
                url = `data:${attachment.mimeType};base64,${attachment.base64}`
                setObjectUrl(url)
            }
        }

        return () => {
            // Only revoke if we created a blob URL
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url)
            }
        }
    }, [attachment, isPdf])

    // Extract simple extension (.pdf, .csv, string)
    let ext = ''
    try {
        const parts = attachment.name.split('.')
        ext = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'DOC'
    } catch { ext = 'FILE' }

    return (
        <div className="group relative h-16 w-16 md:h-20 md:w-20 shrink-0 rounded-2xl border border-border bg-muted overflow-hidden cursor-pointer hover:ring-2 hover:ring-ring transition-all"
            onClick={onClick}>
            {isImage && objectUrl ? (
                <img src={objectUrl} alt="attachment" className="w-full h-full object-cover" />
            ) : isPdf && objectUrl ? (
                <div className="w-full h-full relative bg-white overflow-hidden">
                    <iframe
                        src={`${objectUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                        className="w-full h-full border-0 pointer-events-none"
                        scrolling="no"
                        aria-hidden
                    />
                    <span className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] font-semibold text-white">PDF</span>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center w-full h-full p-2 text-muted-foreground bg-card">
                    <FileText className="h-6 w-6 md:h-8 md:w-8 mb-1 opacity-80" />
                    <span className="text-[9px] font-bold tracking-wider">{ext}</span>
                </div>
            )}

            {onRemove && (
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove() }}
                    className="absolute -top-1 -right-1 h-5 w-5 bg-background border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                    <X className="h-3 w-3" />
                </button>
            )}
        </div>
    )
}
