import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { adminSettings, userModels, mcpTools, chatSessions, chatMessages, chatFiles } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { parseFile, isImageFile, isDocumentFile } from "@/lib/parsers";

/** Strip <think>...</think> blocks (including unclosed ones) and trim. */
function stripThink(text: string): string {
    // Remove complete <think>...</think> blocks first
    let result = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
    // Remove any remaining unclosed <think> block (from <think> to end of string)
    result = result.replace(/<think>[\s\S]*/gi, '');
    return result.trim();
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const body = await req.json();
        const {
            messages,       // { role, content }[]
            sessionId,      // string | null
            selectedModel,  // string
            attachments,    // { name, mimeType, base64 }[] — for new messages
            systemPrompt,   // string | null
            editMessageId,  // string | null - if editing, truncate history at this point
            keepFileIds,    // string[] — file IDs from the old user message to keep
            newAttachments, // { name, mimeType, base64 }[] — additional files in edit mode
        } = body;

        const userId = session.user.id as string;

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const send = (data: object) => {
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                    } catch { }
                };

                try {
                    // ─── 1. Session Management ───────────────────────────────────────
                    let currentSessionId = sessionId as string | null;

                    if (!currentSessionId) {
                        const [newSession] = await db.insert(chatSessions).values({
                            userId,
                            modelName: selectedModel || 'default',
                            title: 'New Chat',
                        }).returning({ id: chatSessions.id });
                        currentSessionId = newSession.id;
                        send({ type: 'session_id', data: currentSessionId });
                    }

                    // If editing: delete this message and all after it
                    // Guard: only act if editMessageId is a valid UUID (prevents PostgreSQL parse errors)
                    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    if (editMessageId && UUID_RE.test(editMessageId as string)) {
                        const editMsg = await db.query.chatMessages.findFirst({
                            where: eq(chatMessages.id, editMessageId as string)
                        });
                        if (editMsg) {
                            // Delete all messages with createdAt >= editMsg.createdAt
                            const allMsgs = await db.query.chatMessages.findMany({
                                where: eq(chatMessages.sessionId, currentSessionId),
                                orderBy: (m, { asc }) => [asc(m.createdAt)]
                            });
                            const cutoffIdx = allMsgs.findIndex(m => m.id === editMessageId);
                            if (cutoffIdx !== -1) {
                                const toDelete = allMsgs.slice(cutoffIdx).map(m => m.id);
                                for (const id of toDelete) {
                                    await db.delete(chatMessages).where(eq(chatMessages.id, id));
                                }
                            }
                        }
                    }

                    // ─── 2. Fetch Config ─────────────────────────────────────────────
                    const [adminConf, userConf, allMcpTools] = await Promise.all([
                        db.query.adminSettings.findFirst(),
                        db.query.userModels.findFirst({ where: eq(userModels.userId, userId) }),
                        db.query.mcpTools.findMany({
                            where: and(eq(mcpTools.userId, userId), eq(mcpTools.isActive, 1))
                        })
                    ]);

                    if (!userConf?.apiUrl || !userConf?.apiKey) {
                        send({ type: 'error', data: '請先在設定頁面配置 API URL 和 Key。' });
                        controller.close();
                        return;
                    }

                    const cleanApiUrl = userConf.apiUrl.replace(/\/+$/, '').replace(/\/v1$/, '');

                    // ─── 3. Build Context from Attachments (all in parallel) ─────────
                    const contextParts: string[] = [];

                    if (attachments && attachments.length > 0) {
                        // Announce parsing start with a single status event
                        send({ type: 'status', data: `正在解析 ${attachments.length} 個附件...` });

                        // Parse ALL attachments concurrently, then collect results in order
                        const parsedParts = await Promise.all(
                            attachments.map(async (att: any) => {
                                const { name, mimeType, base64 } = att;

                                if (isImageFile(name, mimeType)) {
                                    if (adminConf?.visionModelUrl && adminConf?.visionModelKey && adminConf?.visionModelName) {
                                        try {
                                            const visionBase = adminConf.visionModelUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
                                            const visionRes = await fetch(`${visionBase}/v1/chat/completions`, {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Authorization': `Bearer ${adminConf.visionModelKey}`
                                                },
                                                body: JSON.stringify({
                                                    model: adminConf.visionModelName,
                                                    messages: [{
                                                        role: 'user',
                                                        content: [
                                                            { type: 'text', text: '請詳細描述這張圖片的內容。' },
                                                            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
                                                        ]
                                                    }],
                                                })
                                            });
                                            if (visionRes.ok) {
                                                const visionData = await visionRes.json();
                                                const desc = stripThink(visionData.choices?.[0]?.message?.content || '');
                                                return `[圖片 ${name} 的描述]\n${desc}`;
                                            }
                                            return `[圖片 ${name} 解析失敗]`;
                                        } catch {
                                            return `[圖片 ${name} 解析失敗]`;
                                        }
                                    } else {
                                        return `[使用者上傳了圖片: ${name}，但未配置圖片解析模型]`;
                                    }

                                } else if (isDocumentFile(name, mimeType)) {
                                    try {
                                        const parsed = await parseFile(name, mimeType, base64);
                                        return `[文件 ${name} 的內容]\n${parsed.content}`;
                                    } catch {
                                        return `[文件 ${name} 解析失敗]`;
                                    }
                                }

                                return null; // unsupported file type — skip
                            })
                        );

                        // Collect non-null results in original order
                        for (const part of parsedParts) {
                            if (part) contextParts.push(part);
                        }
                    }

                    // ─── 4. MCP Tool Dispatch ───────────────────────────────────────
                    const mcpResults: string[] = [];

                    if (allMcpTools.length > 0 && adminConf?.taskModelUrl && adminConf?.taskModelKey && adminConf?.taskModelName) {
                        const userPrompt = messages[messages.length - 1]?.content || '';
                        const toolSpecs = allMcpTools.map((t: any) => ({
                            name: (t.info as any)?.title || t.url,
                            url: t.url,
                            path: t.path,
                            type: t.type,
                            auth_type: t.auth_type,
                            spec: t.spec,
                        }));

                        const toolSpecText = JSON.stringify(toolSpecs, null, 2);
                        const taskPrompt = `You are a tool dispatcher. Given the user's request and available tools, decide which tools to call and with what parameters. Respond ONLY with a JSON array of tool calls: [{\"tool_index\": 0, \"method\": \"GET\", \"url\": \"...\", \"params\": {}, \"headers\": {}}]. If no tools needed, respond with [].\n\nAvailable tools:\n${toolSpecText}\n\nUser request: ${userPrompt}`;

                        send({ type: 'status', data: `正在分析可用工具...` });

                        try {
                            const taskBase = adminConf.taskModelUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
                            const taskRes = await fetch(`${taskBase}/v1/chat/completions`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${adminConf.taskModelKey}`
                                },
                                body: JSON.stringify({
                                    model: adminConf.taskModelName,
                                    messages: [{ role: 'user', content: taskPrompt }],
                                    temperature: 0,
                                })
                            });

                            if (taskRes.ok) {
                                const taskData = await taskRes.json();
                                const raw = stripThink(taskData.choices?.[0]?.message?.content || '[]');
                                const jsonMatch = raw.match(/\[[\s\S]*\]/);
                                if (jsonMatch) {
                                    const toolCalls = JSON.parse(jsonMatch[0]);
                                    for (const call of toolCalls) {
                                        const toolInfo = toolSpecs[call.tool_index];
                                        send({ type: 'status', data: `正在調用 MCP 工具 [${toolInfo?.name || call.url}]...` });
                                        try {
                                            const mcpRes = await fetch(call.url, {
                                                method: call.method || 'GET',
                                                headers: call.headers || {},
                                                body: call.method !== 'GET' ? JSON.stringify(call.params) : undefined,
                                            });
                                            const mcpData = await mcpRes.text();
                                            mcpResults.push(`[MCP 工具 ${toolInfo?.name || call.url} 回應]\n${mcpData}`);
                                        } catch (e: any) {
                                            mcpResults.push(`[MCP 工具 ${toolInfo?.name} 調用失敗: ${e.message}]`);
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            // Task model failed, continue without MCP
                        }
                    }

                    // ─── 5. Build Final Messages ────────────────────────────────────
                    send({ type: 'status', data: '' });

                    const finalMessages: { role: string; content: string }[] = [];

                    // System prompt
                    const sysContent = [
                        systemPrompt || '',
                        contextParts.length > 0 ? `\n\n以下是附加的上下文資訊：\n${contextParts.join('\n\n')}` : '',
                        mcpResults.length > 0 ? `\n\n以下是工具查詢結果：\n${mcpResults.join('\n\n')}` : '',
                    ].filter(Boolean).join('');

                    if (sysContent.trim()) {
                        finalMessages.push({ role: 'system', content: sysContent.trim() });
                    }

                    // Conversation history
                    for (const m of messages) {
                        finalMessages.push({ role: m.role, content: m.content });
                    }

                    // ─── 6. Save User Message ───────────────────────────────────────
                    const userContent = messages[messages.length - 1]?.content || '';
                    const [savedUserMsg] = await db.insert(chatMessages).values({
                        sessionId: currentSessionId,
                        userId,
                        role: 'user',
                        content: userContent,
                        // Save full attachment including base64 so history can re-render them
                        attachments: (attachments || []).map((a: any) => ({
                            name: a.name,
                            mimeType: a.mimeType,
                            base64: a.base64 || null,
                        })) as any,
                        toolCalls: [] as any
                    }).returning({ id: chatMessages.id });

                    // ─── 7. Stream Main Generation ──────────────────────────────────
                    const response = await fetch(`${cleanApiUrl}/v1/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${userConf.apiKey}`
                        },
                        body: JSON.stringify({
                            model: selectedModel,
                            messages: finalMessages,
                            stream: true
                        })
                    });

                    if (!response.ok) {
                        send({ type: 'error', data: `API 錯誤: ${response.status} ${response.statusText}` });
                        controller.close();
                        return;
                    }

                    const reader = response.body?.getReader();
                    const decoder = new TextDecoder();
                    let fullContent = '';

                    if (reader) {
                        let buffer = '';
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            buffer += decoder.decode(value, { stream: true });

                            const lines = buffer.split('\n');
                            buffer = lines.pop() || ''; // keep incomplete line

                            for (const line of lines) {
                                if (!line.startsWith('data: ')) continue;
                                const dataStr = line.slice(6).trim();
                                if (dataStr === '[DONE]') continue;
                                try {
                                    const parsed = JSON.parse(dataStr);
                                    const delta = parsed.choices?.[0]?.delta?.content || '';
                                    if (delta) {
                                        fullContent += delta;
                                        send({ type: 'chunk', data: delta });
                                    }
                                } catch { }
                            }
                        }
                    }

                    // ─── 8. Save Assistant Message ──────────────────────────────────
                    const [savedMsg] = await db.insert(chatMessages).values({
                        sessionId: currentSessionId,
                        userId,
                        role: 'assistant',
                        content: fullContent,
                        toolCalls: mcpResults.length > 0 ? mcpResults as any : [] as any
                    }).returning({ id: chatMessages.id });

                    // ─── 9. Unblock client immediately, generate title in background ──
                    // Send done right away so the client can set isGenerating=false
                    // without waiting for the title model (which can take up to 10s).
                    send({ type: 'done', data: { messageId: savedMsg?.id, userMessageId: savedUserMsg?.id } });

                    // Generate title after unblocking (stream stays open until close)
                    const titlePromise = generateChatTitle(currentSessionId, userId, userContent, adminConf, fullContent);
                    const titleTimeout = new Promise<void>(r => setTimeout(r, 10000));
                    await Promise.race([titlePromise, titleTimeout]);

                    send({ type: 'title_updated', data: { sessionId: currentSessionId } });
                    controller.close();

                } catch (e: any) {
                    send({ type: 'error', data: e.message || 'Unknown error' });
                    controller.close();
                }
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

async function generateChatTitle(
    sessionId: string,
    userId: string,
    userPrompt: string,
    adminConf: any,
    assistantResponse: string
) {
    if (!adminConf?.workModelUrl || !adminConf?.workModelKey || !adminConf?.workModelName) return;

    try {
        const workBase = adminConf.workModelUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
        const res = await fetch(`${workBase}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminConf.workModelKey}`
            },
            body: JSON.stringify({
                model: adminConf.workModelName,
                messages: [
                    {
                        role: 'user',
                        content: `根據以下對話，生成一個簡短的標題（不超過20個字，不加引號）：\n\n用戶：${userPrompt}\n\n助手：${assistantResponse.slice(0, 200)}`
                    }
                ],
                // max_tokens: 50,
                temperature: 0.7,
            })
        });

        if (res.ok) {
            const data = await res.json();
            const rawTitle = stripThink(data.choices?.[0]?.message?.content || '');
            const title = rawTitle.replace(/^["'「『]|["'」』]$/g, '').trim();
            if (title) {
                await db.update(chatSessions)
                    .set({ title, updatedAt: new Date() })
                    .where(eq(chatSessions.id, sessionId));
            }
        }
    } catch { }
}
