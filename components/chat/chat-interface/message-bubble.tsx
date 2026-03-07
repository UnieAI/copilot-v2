"use client"

import { useRef } from "react"
import { Edit2, RefreshCw, Check, Paperclip } from "lucide-react"
import { AttachmentThumbnail } from "./attachment-thumbnail"
import { MessageContent } from "./markdown-components"
import type { Attachment, UIMessage } from "./types"
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_DOC_TYPES } from "./types"

export function MessageBubble({
    msg,
    isGenerating,
    editingId,
    editContent,
    editAttachments,
    editKeepAttachments,
    onStartEdit,
    onCancelEdit,
    onCommitEdit,
    onSetEditContent,
    onSetEditAttachments,
    onSetEditKeepAttachments,
    onHandleFileSelect,
    onRegenerate,
    onPreviewAttachment,
}: {
    msg: UIMessage
    isGenerating: boolean
    editingId: string | null
    editContent: string
    editAttachments: Attachment[]
    editKeepAttachments: Attachment[]
    onStartEdit: (msg: UIMessage) => void
    onCancelEdit: () => void
    onCommitEdit: (msg: UIMessage) => void
    onSetEditContent: (content: string) => void
    onSetEditAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>
    onSetEditKeepAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>
    onHandleFileSelect: (files: FileList | null, isEdit?: boolean) => void
    onRegenerate: (msgId: string) => void
    onPreviewAttachment: (att: Attachment) => void
}) {
    const editFileInputRef = useRef<HTMLInputElement>(null)

    return (
        <div className={`flex w-full group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start w-full'}`}>
                {editingId === msg.id ? (
                    <div className="w-full space-y-3 bg-card p-4 rounded-xl border border-border shadow-sm">
                        <textarea
                            value={editContent}
                            onChange={e => onSetEditContent(e.target.value)}
                            rows={4}
                            autoFocus
                            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                        />
                        {msg.role === 'user' && (
                            <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                    {editKeepAttachments.map((att, i) => (
                                        <AttachmentThumbnail key={`keep-${i}`} attachment={att} onRemove={() => onSetEditKeepAttachments(prev => prev.filter((_, j) => j !== i))} onClick={() => onPreviewAttachment(att)} />
                                    ))}
                                    {editAttachments.map((att, i) => (
                                        <AttachmentThumbnail key={`new-${i}`} attachment={att} onRemove={() => onSetEditAttachments(prev => prev.filter((_, j) => j !== i))} onClick={() => onPreviewAttachment(att)} />
                                    ))}
                                </div>
                                <input type="file" ref={editFileInputRef} className="hidden" multiple
                                    accept={`${ACCEPTED_IMAGE_TYPES},${ACCEPTED_DOC_TYPES}`}
                                    onChange={e => { onHandleFileSelect(e.target.files, true); e.target.value = '' }}
                                />
                                <button type="button" onClick={() => editFileInputRef.current?.click()}
                                    disabled={isGenerating}
                                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed bg-muted px-3 py-1.5 rounded-md"
                                >
                                    <Paperclip className="h-3.5 w-3.5" /> 附加檔案
                                </button>
                            </div>
                        )}
                        <div className="flex gap-2 justify-end pt-2">
                            <button onClick={onCancelEdit}
                                disabled={isGenerating}
                                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                取消
                            </button>
                            <button onClick={() => onCommitEdit(msg)}
                                disabled={isGenerating}
                                className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Check className="h-3.5 w-3.5" />
                                {msg.role === 'user' ? '儲存並重新生成' : '儲存'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div className={`flex flex-wrap gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.attachments.map((att, i) => (
                                    <AttachmentThumbnail key={i} attachment={{ ...att, base64: att.base64 || '' }} onClick={() => onPreviewAttachment({ ...att, base64: att.base64 || '' })} />
                                ))}
                            </div>
                        )}

                        {msg.content && (
                            <div className={`
                                relative text-[15px] leading-relaxed
                                ${msg.role === 'user'
                                    ? 'bg-muted text-foreground px-5 py-3.5 rounded-[24px] rounded-br-sm'
                                    : 'bg-transparent text-foreground py-1 w-full'
                                }
                            `}>
                                {msg.role === 'assistant'
                                    ? <MessageContent content={msg.content} isStreaming={msg.isStreaming} />
                                    : <p className="whitespace-pre-wrap">{msg.content}</p>
                                }

                                {!msg.isStreaming && (
                                    <div className={`absolute -bottom-9 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'right-0' : '-left-2'}`}>
                                        <button
                                            onClick={() => onStartEdit(msg)}
                                            disabled={isGenerating}
                                            className="flex items-center gap-1.5 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted bg-background/50 backdrop-blur-sm border border-transparent hover:border-border transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                            title="編輯"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </button>
                                        {msg.role === 'assistant' && (
                                            <button
                                                onClick={() => onRegenerate(msg.id)}
                                                disabled={isGenerating}
                                                className="flex items-center gap-1.5 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted bg-background/50 backdrop-blur-sm border border-transparent hover:border-border transition-all disabled:opacity-50 shadow-sm"
                                                title="重新生成"
                                            >
                                                <RefreshCw className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
