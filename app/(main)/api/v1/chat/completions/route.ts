import { isDevelopment } from "@/utils";
import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // 從請求中獲取用戶設定
    const userSettings = body.settings || {};
    const streaming = body.stream === false ? false : true;

    // 使用用戶設定或默認設定
    const apiKey = userSettings.apiKey;
    const baseUrl = userSettings.apiUrl;
    const model = userSettings.selectedModel;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 400 });
    }

    if (!baseUrl) {
      return NextResponse.json({ error: "Missing API URL" }, { status: 400 });
    }

    if (!model) {
      return NextResponse.json({ error: "Missing model" }, { status: 400 });
    }

    const chatUrl = `${baseUrl}/v1/chat/completions`
    if (isDevelopment) console.log(body.max_tokens)

    const response = await fetch(chatUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: body.messages,
        stream: streaming,
        temperature: body.temperature || 0.7,
        max_tokens: body.max_tokens || 32000,
        top_p: body.top_p || 1,
        top_k: body.top_k || 50,
      }),
    })

    if (!response.ok) {
      const data = await response.json();
      console.error("API Error Response:", data);
      return Response.json(
        data,
        { status: response.status }
      );
    }

    if (streaming === false) {
      const result = await response.json();
      return NextResponse.json(result); // ✅ 回傳整包 JSON 結構
    } else {
      // 創建 ReadableStream 來處理 streaming 響應
      const stream = new ReadableStream({
        start(controller) {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          let buffer = "";
          function pump(): Promise<void> {
            return reader!.read().then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }

              buffer += decoder.decode(value, { stream: true });
              const lastNewLineIndex = buffer.lastIndexOf("\n");
              if (lastNewLineIndex !== -1) {
                const chunk = buffer.slice(0, lastNewLineIndex);
                buffer = buffer.slice(lastNewLineIndex + 1); // add 1 to skip the newline symbol
                processLines(chunk, controller);
              }

              return pump();
            })
          }

          function processLines(text: string, controller: ReadableStreamDefaultController) {
            const lines = text.split("\n");

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;

              if (trimmedLine.startsWith("data: ")) {
                const data = trimmedLine.slice(6);
                if (data === "[DONE]") {
                  controller.close();
                  return;
                }
                try {
                  controller.enqueue(`data: ${data}\n\n`);
                } catch (e) {
                  // 忽略解析錯誤
                }
              }
            }
          }

          return pump();
        },
      })

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
