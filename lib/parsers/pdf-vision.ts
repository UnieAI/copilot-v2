/**
 * PDF processing using mupdf to convert each page to images,
 * then analyze with VLM concurrently
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { adminSettings } from "@/lib/db/schema";

export type VisionConfig = {
    url: string
    key: string
    model: string
}

export type PdfVisionProgress =
    | { type: "status"; message: string }
    | { type: "page_progress"; page: number; totalPages: number; summary: string }
    | { type: "done"; summary: string; pageResults: { page: number; summary: string }[] }
    | { type: "error"; message: string }

const sanitizeBaseUrl = (url: string) => url.replace(/\/+$/, "").replace(/\/v1$/, "")

export async function processPdfPagesWithVLM(opts: {
    name: string
    base64: string
    onProgress?: (ev: PdfVisionProgress) => void
}) {
    const { name, base64, onProgress } = opts

    onProgress?.({ type: "status", message: `正在獲取 VLM 配置...` })

    // Get VLM config from database
    const adminConf = await db.query.adminSettings.findFirst();
    if (!adminConf?.visionModelUrl || !adminConf?.visionModelKey || !adminConf?.visionModelName) {
        throw new Error("Vision model not configured");
    }

    const visionConfig: VisionConfig = {
        url: adminConf.visionModelUrl,
        key: adminConf.visionModelKey,
        model: adminConf.visionModelName,
    }

    // Step 1: Convert PDF pages to images
    onProgress?.({ type: "status", message: `正在將 PDF "${name}" 轉換為圖片...` })

    const pagesResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/pdf-pages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // Note: This will be called from the server, so we need proper auth
        },
        body: JSON.stringify({ name, base64 }),
    });

    if (!pagesResponse.ok) {
        throw new Error(`PDF page conversion failed: ${pagesResponse.status}`);
    }

    const { images } = await pagesResponse.json();
    if (!images || images.length === 0) {
        throw new Error("No pages found in PDF");
    }

    onProgress?.({ type: "status", message: `PDF 共 ${images.length} 頁，開始並行分析...` })

    // Step 2: Analyze each page concurrently with VLM
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

    // Step 3: Combine results in page order
    const combinedSummary = successfulResults
        .sort((a, b) => a.page - b.page)
        .map(({ page, summary }) => `第 ${page} 頁摘要：\n${summary}`)
        .join('\n\n');

    const finalSummary = `以下是 PDF "${name}" 的完整分析（共 ${images.length} 頁）：\n\n${combinedSummary}`;

    onProgress?.({ type: "done", summary: finalSummary, pageResults: successfulResults });

    return finalSummary;
}

async function analyzePageWithVLM(page: { index: number; mimeType: string; base64: string }, vision: VisionConfig): Promise<string> {
    const visionBase = sanitizeBaseUrl(vision.url);

    const prompt = `你是一個 PDF 頁面分析專家。請詳細分析這張PDF頁面的內容，包括：

1. 所有可見的文字內容（請保持原文格式）
2. 圖片、圖表、表格的描述和數據
3. 版面結構和重要元素的排列
4. 任何特殊的格式、顏色或視覺強調

請提供完整而詳細的分析。`;

    const res = await fetch(`${visionBase}/v1/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${vision.key}`
        },
        body: JSON.stringify({
            model: vision.model,
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: `data:${page.mimeType};base64,${page.base64}` } }
                ]
            }],
            max_tokens: 4096,
            stream: false
        })
    });

    if (!res.ok) {
        const msg = `Vision API 回應錯誤 (${res.status})`
        throw new Error(msg)
    }

    const json = await res.json()
    const summary = (json?.choices?.[0]?.message?.content || "").trim() || "（無內容）"
    return summary;
}

// Legacy function for backward compatibility
export async function describePdfWithVision(opts: {
    name: string
    base64: string
    vision: VisionConfig
    onProgress?: (ev: PdfVisionProgress) => void
}) {
    // For now, fall back to the new page-based approach
    // This maintains API compatibility while improving functionality
    return processPdfPagesWithVLM(opts);
}

export function isPdf(name: string, mimeType: string) {
    const ext = name.split(".").pop()?.toLowerCase() || ""
    return ext === "pdf" || mimeType === "application/pdf"
}