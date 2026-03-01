/**
 * Enhanced PDF processing using mupdf to convert each page to images,
 * then analyze with VLM concurrently - following the demonstration scripts
 */

import { db } from "@/lib/db";
import { adminSettings } from "@/lib/db/schema";
import { parseFile } from ".";

export type PdfVisionProgress =
    | { type: "status"; message: string }
    | { type: "page_progress"; page: number; totalPages: number; summary: string }
    | { type: "done"; summary: string; pageResults: { page: number; summary: string }[] }
    | { type: "error"; message: string }

const sanitizeBaseUrl = (url: string) => url.replace(/\/+$/, "").replace(/\/v1$/, "")

export function isPdf(name: string, mimeType: string) {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return ext === "pdf" || mimeType === "application/pdf";
}

/**
 * Convert PDF pages to images using mupdf directly
 */
function renderPdfPagesToImages(mupdf: any, data: Uint8Array): { index: number; mimeType: string; base64: string }[] {
    const doc = mupdf.Document.openDocument(data, "application/pdf");
    const numPages = doc.countPages();
    const results: { index: number; mimeType: string; base64: string }[] = [];

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

export async function processPdfPagesEnhanced(opts: {
    name: string
    base64: string
    mimeType: string
    onProgress?: (ev: PdfVisionProgress) => void
}) {
    const { name, base64, mimeType, onProgress } = opts

    onProgress?.({ type: "status", message: `正在獲取 VLM 配置...` })

    // Get VLM config from database (same as single image processing in route.ts)
    const adminConf = await db.query.adminSettings.findFirst();
    if (!adminConf?.visionModelUrl || !adminConf?.visionModelKey || !adminConf?.visionModelName) {
        throw new Error("Vision model not configured");
    }

    const visionConfig = {
        url: adminConf.visionModelUrl,
        key: adminConf.visionModelKey,
        model: adminConf.visionModelName,
    }

    // Step 1: Convert PDF pages to images using direct function call
    onProgress?.({ type: "status", message: `正在將 PDF "${name}" 轉換為圖片...` })

    try {
        if (!isPdf(name, mimeType)) {
            throw new Error("Invalid PDF file");
        }

        // base64 → Uint8Array (handle if base64 has data: prefix)
        let cleanBase64 = base64;
        if (base64.startsWith("data:")) {
            cleanBase64 = base64.split(",")[1] || "";
        }
        const binaryString = atob(cleanBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Dynamic import to avoid bundler resolving mupdf at build time
        const mupdf = await import("mupdf");

        const images = renderPdfPagesToImages(mupdf, bytes);
        if (!images || images.length === 0) {
            throw new Error("No pages found in PDF");
        }

        onProgress?.({ type: "status", message: `PDF 共 ${images.length} 頁，開始並行分析...` })

        // Step 2: Analyze each page concurrently with VLM (same as single image VLM call)
        const pageResults = await Promise.allSettled(
            images.map(async (page: { index: number; mimeType: string; base64: string }) => {
                const summary = await analyzePageWithVLM(page, visionConfig);
                onProgress?.({
                    type: "page_progress",
                    page: page.index + 1,
                    totalPages: images.length,
                    summary
                });
                return { page: page.index + 1, summary };
            })
        );

        // Extract successful results
        const successfulResults = pageResults
            .filter((result): result is PromiseFulfilledResult<{ page: number; summary: string }> =>
                result.status === 'fulfilled'
            )
            .map(result => result.value);

        // Step 3: Combine results in page order (sort by page number)
        const combinedSummary = successfulResults
            .sort((a, b) => a.page - b.page)
            .map(({ page, summary }) => `第 ${page} 頁摘要：\n${summary}`)
            .join('\n\n');

        const finalSummary = `以下是 PDF "${name}" 的完整分析（共 ${images.length} 頁）：\n\n${combinedSummary}`;

        onProgress?.({ type: "done", summary: finalSummary, pageResults: successfulResults });

        return finalSummary;
    } catch (error: any) {
        // Fallback to text-based parsing if VLM processing fails (same as in route.ts)
        onProgress?.({ 
            type: "status", 
            message: `VLM處理失敗，改用文字解析: ${error?.message || ''}` 
        });
        
        try {
            const parsed = await parseFile(name, mimeType, base64);
            return parsed.content
                ? `[PDF ${name} 文本內容]\n${parsed.content}`
                : `[PDF ${name} 解析失敗]`;
        } catch {
            return `[PDF ${name} 解析失敗]`;
        }
    }
}

async function analyzePageWithVLM(page: { index: number; mimeType: string; base64: string }, vision: { url: string; key: string; model: string }): Promise<string> {
    const visionBase = sanitizeBaseUrl(vision.url);

    // VLM API call (identical to single image processing in route.ts)
    const payload = {
        model: vision.model,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${page.mimeType};base64,${page.base64}`,
                        },
                    },
                    {
                        type: "text",
                        text: "請詳細描述這張圖片的內容，包括文字、圖表、表格等所有可見資訊。",
                    },
                ],
            },
        ],
        max_tokens: 4096,
    };

    const res = await fetch(`${visionBase}/v1/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${vision.key}`
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Vision API error ${res.status}: ${errText}`);
    }

    const json = await res.json()
    const summary = (json?.choices?.[0]?.message?.content || "").trim() || "（無內容）"
    return summary;
}