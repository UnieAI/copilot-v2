/**
 * Universal File Parser
 * Supports: PDF, DOC, DOCX, CSV, TXT, MD
 * Images (JPG/PNG) are handled separately via the Vision Model
 */

export type ParsedFile = {
    name: string
    content: string
    type: string
    images?: { index: number; mimeType: string; base64: string }[]
}

export async function parseFile(name: string, mimeType: string, base64Data: string): Promise<ParsedFile> {
    const buffer = Buffer.from(base64Data, 'base64')
    const ext = name.split('.').pop()?.toLowerCase() || ''

    if (ext === 'pdf' || mimeType === 'application/pdf') {
        return parsePdf(name, base64Data)
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

async function parsePdf(name: string, base64Data: string): Promise<ParsedFile> {
  try {
    console.log(`[parsePdf] base64Data length: ${base64Data.length}`);

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`[parsePdf] bytes length: ${bytes.length}`);

    const mupdfModule = await import("mupdf");
    console.log(`[parsePdf] mupdfModule loaded:`, typeof mupdfModule, Object.keys(mupdfModule));

    const mupdf = mupdfModule; // 或 mupdfModule.default 如果有 default export

    if (typeof mupdf.Document !== 'function') {
      throw new Error("mupdf.Document is not a function");
    }

    const results = renderPages(mupdf, bytes);

    console.log(`[parsePdf] results count: ${results.length}`);

    return {
      name,
      content: "pdf 解析成功",
      type: "pdf",
      images: results,
    };
  } catch (e: any) {
    console.error(`[parsePdf] 轉圖失敗: ${name}`, e);
    console.error(e.stack); // 印完整 stack trace
    return {
      name,
      content: "pdf 解析失敗",
      type: "pdf",
      images: [],
    };
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

function renderPages(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mupdf: any,
    data: Uint8Array
): {
    index: number;
    mimeType: string;
    base64: string;
}[] {
    const doc = mupdf.Document.openDocument(data, "application/pdf");
    const numPages = doc.countPages();
    const results: {
        index: number;
        mimeType: string;
        base64: string;
    }[] = [];

    for (let i = 0; i < numPages; i++) {
        const page = doc.loadPage(i);
        const pixmap = page.toPixmap(
            [2, 0, 0, 2, 0, 0], // scale 2x matrix [a,b,c,d,e,f]
            mupdf.ColorSpace.DeviceRGB,
            false,
            true
        );
        const pngBytes: Uint8Array = pixmap.asPNG();
        results.push({
            index: i,
            mimeType: "image/png",
            base64: Buffer.from(pngBytes).toString("base64"),
        });
        pixmap.destroy();
        page.destroy();
    }

    doc.destroy();
    return results;
}

/** 移除所有 <think> 相關的思考區塊，只保留最終輸出內容 */
export function stripThinkAndKeepFinal(text: string): string {
  let result = text;

  // 步驟1：移除所有完整的 <think>...</think> 區塊（可有多個）
  result = result.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // 步驟2：如果有未關閉的 <think>（從 <think> 到結尾全部移除）
  const openThinkIndex = result.search(/<think>/i);
  if (openThinkIndex !== -1) {
    result = result.substring(0, openThinkIndex).trim();
  }

  // 步驟3：如果有孤立的 </think>（沒有對應 <think>），把 </think> 之前全部移除
  const closeThinkIndex = result.search(/<\/think>/i);
  if (closeThinkIndex !== -1 && openThinkIndex === -1) {
    result = result.substring(closeThinkIndex + '</think>'.length).trim();
  }

  // 步驟4：最終清理多餘空白、換行
  return result.trim();
}
