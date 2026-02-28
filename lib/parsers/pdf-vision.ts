/**
 * Delegate PDF understanding to the vision model directly (no local PDF parsing).
 * Sends the full PDF as a data URL and guides the VLM via prompt.
 */

export type VisionConfig = {
    url: string
    key: string
    model: string
}

export type PdfVisionProgress =
    | { type: "status"; message: string }
    | { type: "done"; summary: string }
    | { type: "error"; message: string }

const sanitizeBaseUrl = (url: string) => url.replace(/\/+$/, "").replace(/\/v1$/, "")

export async function describePdfWithVision(opts: {
    name: string
    base64: string
    vision: VisionConfig
    onProgress?: (ev: PdfVisionProgress) => void
}) {
    const { name, base64, vision, onProgress } = opts
    const visionBase = sanitizeBaseUrl(vision.url)

    onProgress?.({ type: "status", message: `PDF ${name} 傳送至視覺模型解析中...` })

    const prompt = [
        `你是一個 PDF 閱讀器，現在有一份名為「${name}」的 PDF。`,
        "請完整閱讀整份 PDF（多頁皆需處理），回傳：",
        "1) 條列式重點摘要（逐頁或整體皆可）",
        "2) 重要文字內容與指示",
        "3) 所有圖片、圖表的大意描述，以及它們的標題/註解/數據重點",
        "4) 列出關鍵名稱、日期、數字或決策事項",
    ].join("\n")

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
                    // Many VLMs accept PDF as a data URL in image_url; we rely on the upstream model to handle PDF input.
                    { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } }
                ]
            }],
            stream: false
        })
    })

    if (!res.ok) {
        const msg = `Vision API 回應錯誤 (${res.status})`
        onProgress?.({ type: "error", message: msg })
        throw new Error(msg)
    }

    const json = await res.json()
    const summary = (json?.choices?.[0]?.message?.content || "").trim() || "（無內容）"
    onProgress?.({ type: "done", summary })
    return summary
}

export function isPdf(name: string, mimeType: string) {
    const ext = name.split(".").pop()?.toLowerCase() || ""
    return ext === "pdf" || mimeType === "application/pdf"
}
