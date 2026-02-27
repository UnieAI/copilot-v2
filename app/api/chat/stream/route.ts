import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { adminSettings, userModels, mcpTools, chatSessions, chatMessages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const body = await req.json();
        const { messages, sessionId, selectedModel, attachments } = body;
        const userId = session.user.id as string;

        // Setup SSE Stream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const sendEvent = (data: any) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                };

                // 1. Validate / Create Session
                let currentSessionId = sessionId;
                if (!currentSessionId) {
                    const newSession = await db.insert(chatSessions).values({
                        userId,
                        modelName: selectedModel || 'default',
                    }).returning({ id: chatSessions.id });
                    currentSessionId = newSession[0].id;

                    // Trigger async worker to generate title from first message
                    sendEvent({ type: 'session_id', data: currentSessionId });
                }

                // Append user message to DB
                const userMsg = messages[messages.length - 1];
                await db.insert(chatMessages).values([{
                    sessionId: currentSessionId as string,
                    userId,
                    role: "user",
                    content: String(userMsg.content),
                    attachments: attachments || []
                }]);

                // Fetch context configs
                const [adminConf, userConf, activeMcp] = await Promise.all([
                    db.query.adminSettings.findFirst(),
                    db.query.userModels.findFirst({ where: eq(userModels.userId, userId) }),
                    db.query.mcpTools.findMany({ where: eq(mcpTools.userId, userId) }) // assumed all active for now
                ]);

                if (!userConf || !userConf.apiUrl || !userConf.apiKey) {
                    sendEvent({ type: 'error', data: 'No model configured. Please go to Settings.' });
                    controller.close();
                    return;
                }

                // 2. Process Attachments (Placeholder logic)
                if (attachments && attachments.length > 0) {
                    sendEvent({ type: 'status', data: `正在解析 ${attachments.length} 個附件...` });
                    // TODO: parse docs or vision
                    await new Promise(r => setTimeout(r, 1000));
                }

                // 3. Process MCP Tools (Placeholder logic)
                if (activeMcp.length > 0 && adminConf?.taskModelUrl && adminConf?.taskModelKey) {
                    sendEvent({ type: 'status', data: `正在調用任務模型分析工具...` });
                    // TODO: Call Task Model to dispatch MCP Tools
                    await new Promise(r => setTimeout(r, 1500));
                }

                // 4. Main Generation Stream
                sendEvent({ type: 'status', data: '' }); // clear status

                const response = await fetch(`${userConf.apiUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userConf.apiKey}`
                    },
                    body: JSON.stringify({
                        model: selectedModel,
                        messages: messages,
                        stream: true
                    })
                });

                if (!response.ok) {
                    sendEvent({ type: 'error', data: `Upstream error: ${response.statusText}` });
                    controller.close();
                    return;
                }

                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let fullContent = "";

                if (reader) {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });

                        // Parse OpenAI SSE format
                        const lines = chunk.split('\n');
                        for (const line of lines) {
                            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                                try {
                                    const parsed = JSON.parse(line.slice(6));
                                    const delta = parsed.choices[0]?.delta?.content || "";
                                    fullContent += delta;
                                    sendEvent({ type: 'chunk', data: delta });
                                } catch (e) {
                                    // ignore incomplete chunks for now
                                }
                            }
                        }
                    }
                }

                // Save assistant message to DB
                await db.insert(chatMessages).values([{
                    sessionId: currentSessionId as string,
                    userId,
                    role: "assistant",
                    content: fullContent,
                }]);

                sendEvent({ type: 'done' });
                controller.close();
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        });

    } catch (e: any) {
        return new Response(e.message, { status: 500 });
    }
}
