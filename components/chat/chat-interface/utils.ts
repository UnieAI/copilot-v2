"use client"

import { useState, useEffect } from "react"
import type { Attachment } from "./types"

export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
    })
}

export function base64ToBlobUrl(base64: string, mimeType: string): string {
    const bin = atob(base64)
    const len = bin.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }))
}

export function useAttachmentPreviewSrc(attachment: Attachment): string | undefined {
    const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined)

    useEffect(() => {
        if (attachment.previewUrl) {
            setBlobUrl(undefined)
            return
        }
        if (!attachment.base64 || attachment.mimeType !== 'application/pdf') {
            setBlobUrl(undefined)
            return
        }

        let url: string | undefined
        try {
            url = base64ToBlobUrl(attachment.base64, attachment.mimeType)
            setBlobUrl(url)
        } catch {
            setBlobUrl(undefined)
        }

        return () => {
            if (url) URL.revokeObjectURL(url)
        }
    }, [attachment.base64, attachment.mimeType, attachment.previewUrl])

    if (attachment.previewUrl) return attachment.previewUrl
    if (blobUrl) return blobUrl
    if (attachment.base64) return `data:${attachment.mimeType};base64,${attachment.base64}`
    return undefined
}

export function getMimeType(file: File) {
    if (file.type) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'png': return 'image/png';
        case 'gif': return 'image/gif';
        case 'webp': return 'image/webp';
        case 'pdf': return 'application/pdf';
        case 'csv': return 'text/csv';
        case 'txt': return 'text/plain';
        case 'md': return 'text/markdown';
        case 'doc': return 'application/msword';
        case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case 'json': return 'application/json';
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
        case 'html':
        case 'css':
        case 'py': return 'text/plain';
        default: return 'application/octet-stream';
    }
}
