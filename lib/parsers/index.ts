/**
 * Universal File Parser
 * Supports: PDF, DOC, DOCX, CSV, TXT, MD
 * Images (JPG/PNG) are handled separately via the Vision Model
 */

export type ParsedFile = {
    name: string
    content: string
    type: string
}

export async function parseFile(name: string, mimeType: string, base64Data: string): Promise<ParsedFile> {
    const buffer = Buffer.from(base64Data, 'base64')
    const ext = name.split('.').pop()?.toLowerCase() || ''

    if (ext === 'pdf' || mimeType === 'application/pdf') {
        return parsePdf(name, buffer)
    }
    if (ext === 'doc' || ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return parseDocx(name, buffer)
    }
    if (ext === 'csv' || mimeType === 'text/csv') {
        return parseCsv(name, buffer)
    }
    const textExtensions = ['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'html', 'py', 'java', 'c', 'cpp', 'rs', 'go', 'sh', 'yaml', 'yml', 'env', 'xml']
    if (textExtensions.includes(ext) || mimeType.startsWith('text/')) {
        return parsePlainText(name, buffer)
    }

    return { name, content: `[Unsupported file type: ${ext}]`, type: ext }
}

async function parsePdf(name: string, buffer: Buffer): Promise<ParsedFile> {
    try {
        // pdf-parse has a quirky API with default options
        const pdfParse = (await import('pdf-parse')).default
        const data = await pdfParse(buffer)
        return {
            name,
            type: 'pdf',
            content: data.text.trim()
        }
    } catch (e: any) {
        return { name, type: 'pdf', content: `[Failed to parse PDF: ${e.message}]` }
    }
}

async function parseDocx(name: string, buffer: Buffer): Promise<ParsedFile> {
    try {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        return {
            name,
            type: 'docx',
            content: result.value.trim()
        }
    } catch (e: any) {
        return { name, type: 'docx', content: `[Failed to parse DOCX: ${e.message}]` }
    }
}

function parseCsv(name: string, buffer: Buffer): ParsedFile {
    const text = buffer.toString('utf-8')
    return { name, type: 'csv', content: text.trim() }
}

function parsePlainText(name: string, buffer: Buffer): ParsedFile {
    const text = buffer.toString('utf-8')
    const ext = name.split('.').pop()?.toLowerCase() || 'txt'
    return { name, type: ext, content: text.trim() }
}

export function isImageFile(name: string, mimeType: string): boolean {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    return ['jpg', 'jpeg', 'png'].includes(ext) || mimeType.startsWith('image/')
}

export function isDocumentFile(name: string, mimeType: string): boolean {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    const docExtensions = ['pdf', 'doc', 'docx', 'csv', 'txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'html', 'py', 'java', 'c', 'cpp', 'rs', 'go', 'sh', 'yaml', 'yml', 'env', 'xml']
    return docExtensions.includes(ext) || mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType.startsWith('application/x-')
}
