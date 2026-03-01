import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { adminSettings } from "@/lib/db/schema";
import { processPdfPagesWithVLM, isPdf, type PdfVisionProgress } from "@/lib/parsers/pdf-vision";
import { parseFile } from "@/lib/parsers";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { name, base64 } = await req.json();
    if (!name || !base64 || !isPdf(name, "application/pdf")) {
        return new Response("Invalid payload", { status: 400 });
    }

    const adminConf = await db.query.adminSettings.findFirst();
    if (!adminConf?.visionModelUrl || !adminConf?.visionModelKey || !adminConf?.visionModelName) {
        return new Response("Vision model not configured", { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

            const onProgress = (ev: PdfVisionProgress) => {
                if (ev.type === "status") send({ type: "status", data: ev.message });
                if (ev.type === "done") send({ type: "done", summary: ev.summary });
                if (ev.type === "error") send({ type: "error", data: ev.message });
            };

            try {
                onProgress({ type: "status", message: "開始解析 PDF..." });
                let summary: string | null = null;

                try {
                    summary = await processPdfPagesWithVLM({
                        name,
                        base64,
                        onProgress,
                    });
                } catch (e: any) {
                    send({ type: "status", data: `視覺模型解析失敗，改用文字解析: ${e?.message || ""}` });
                    const parsed = await parseFile(name, "application/pdf", base64);
                    summary = parsed.content || "（無內容）";
                }

                send({ type: "done", summary });
            } catch (e: any) {
                send({ type: "error", data: e?.message || "解析失敗" });
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}
