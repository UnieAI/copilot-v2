import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { adminSettings, userProviders, mcpTools, chatSessions, chatMessages, chatFiles, userGroups, groupProviders, groupTokenUsage, tokenUsage, groupUserQuotas, groupUserModelQuotas, groupModelQuotas, globalProviders, globalProviderRoleModelQuotas } from "@/lib/db/schema";
import { eq, and, inArray, sql, gte } from "drizzle-orm";
import { parseFile, isImageFile, isDocumentFile, stripThinkAndKeepFinal } from "@/lib/parsers";
import { processPdfPagesEnhanced, isPdf } from "@/lib/parsers/pdf-enhanced";
import { getQuotaWindow } from "@/lib/quota-window";

/** Strip <think>...</think> blocks (including unclosed ones) and trim. */
function stripThink(text: string): string {
    // Remove complete <think>...</think> blocks first
    let result = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
    // Remove any remaining unclosed <think> block (from <think> to end of string)
    result = result.replace(/<think>[\s\S]*/gi, '');
    return result.trim();
}

function formatQuotaResetTime(date: Date): string {
    return new Intl.DateTimeFormat("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(date);
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
            projectId,      // string | null — assign new session to a project
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

                    // Parse composite model value "{prefix}-{modelId}"
                    const dashIdx = (selectedModel as string || '').indexOf('-');
                    const providerPrefix = dashIdx > -1 ? (selectedModel as string).slice(0, dashIdx) : '';
                    const realModelName = dashIdx > -1 ? (selectedModel as string).slice(dashIdx + 1) : (selectedModel as string);

                    if (!currentSessionId) {
                        const [newSession] = await db.insert(chatSessions).values({
                            userId,
                            modelName: realModelName || selectedModel || 'default',
                            providerPrefix: providerPrefix || null,
                            systemPrompt: (systemPrompt || '').trim() || null,
                            title: 'New Chat',
                            projectId: projectId || null,
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
                    const [adminConf, allMcpTools] = await Promise.all([
                        db.query.adminSettings.findFirst(),
                        db.query.mcpTools.findMany({
                            where: and(eq(mcpTools.userId, userId), eq(mcpTools.isActive, 1))
                        })
                    ]);

                    // Determine accessible groups for this user
                    const memberships = await db.query.userGroups.findMany({
                        where: eq(userGroups.userId, userId),
                    });
                    const memberGroupIds = memberships.map(g => g.groupId);
                    let providerGroupId: string | null = null;
                    let providerScope: "user" | "group" | "global" | null = null;
                    let providerGlobalId: string | null = null;
                    const currentUserRole = ((session.user as any).role || "user") as string;

                    // Look up provider by prefix (personal first, then group, then global)
                    let providerConf: any =
                        providerPrefix
                            ? await db.query.userProviders.findFirst({
                                where: and(eq(userProviders.userId, userId), eq(userProviders.prefix, providerPrefix), eq(userProviders.enable, 1))
                            })
                            : await db.query.userProviders.findFirst({
                                where: and(eq(userProviders.userId, userId), eq(userProviders.enable, 1))
                            });

                    if (providerConf) {
                        providerScope = "user";
                    }

                    if (!providerConf && providerPrefix && memberGroupIds.length > 0) {
                        providerConf = await db.query.groupProviders.findFirst({
                            where: and(
                                eq(groupProviders.prefix, providerPrefix),
                                inArray(groupProviders.groupId, memberGroupIds),
                                eq(groupProviders.enable, 1),
                            ),
                        });
                        if (providerConf) {
                            providerGroupId = (providerConf as any).groupId;
                            providerScope = "group";
                        }
                    }

                    // Fallback: only when no prefix is specified
                    if (!providerConf && !providerPrefix && memberGroupIds.length > 0) {
                        providerConf = await db.query.groupProviders.findFirst({
                            where: and(
                                inArray(groupProviders.groupId, memberGroupIds),
                                eq(groupProviders.enable, 1),
                            ),
                        });
                        if (providerConf) {
                            providerGroupId = (providerConf as any).groupId;
                            providerScope = "group";
                        }
                    }

                    // Prefix-selected global provider
                    if (!providerConf && providerPrefix) {
                        providerConf = await db.query.globalProviders.findFirst({
                            where: and(eq(globalProviders.prefix, providerPrefix), eq(globalProviders.enable, 1)),
                        });
                        if (providerConf) {
                            providerGlobalId = (providerConf as any).id;
                            providerScope = "global";
                        }
                    }

                    // Fallback: only when no prefix is specified
                    if (!providerConf && !providerPrefix) {
                        providerConf = await db.query.globalProviders.findFirst({
                            where: eq(globalProviders.enable, 1),
                        });
                        if (providerConf) {
                            providerGlobalId = (providerConf as any).id;
                            providerScope = "global";
                        }
                    }

                    // If a specific provider prefix was selected but cannot be resolved, do not fall back to other providers.
                    if (!providerConf && providerPrefix) {
                        send({ type: 'error', data: '所選模型來源不可用，請重新選擇模型。' });
                        controller.close();
                        return;
                    }

                    if (!providerConf?.apiUrl || !providerConf?.apiKey) {
                        send({ type: 'error', data: '尚未配置可用的 Provider，若您屬於群組請聯絡管理員。' });
                        controller.close();
                        return;
                    }

                    const requestedModel = realModelName || selectedModel;
                    const selectedModels = Array.isArray((providerConf as any)?.selectedModels)
                        ? ((providerConf as any).selectedModels as string[])
                        : null;
                    if (selectedModels && (selectedModels.length === 0 || !selectedModels.includes(requestedModel))) {
                        send({ type: 'error', data: 'Selected model is not enabled for this provider.' });
                        controller.close();
                        return;
                    }

                    const cleanApiUrl = providerConf.apiUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
                    const visionConfig = (adminConf?.visionModelUrl && adminConf?.visionModelKey && adminConf?.visionModelName)
                        ? {
                            url: adminConf.visionModelUrl,
                            key: adminConf.visionModelKey,
                            model: adminConf.visionModelName,
                        }
                        : null;

                    // ─── 3. Build Context from Attachments (all in parallel) ─────────
                    const contextParts: string[] = [];
                    let parsedParts: (string | null)[] = [];

                    if (attachments && attachments.length > 0) {
                        // Announce parsing start with a single status event
                        send({ type: 'status', data: `正在解析 ${attachments.length} 個附件...` });

                        // Parse ALL attachments concurrently, then collect results in order
                        parsedParts = await Promise.all(
                            attachments.map(async (att: any) => {
                                const { name, mimeType, base64 } = att;

                                if (isPdf(name, mimeType)) {
                                    // 先呼叫 parseFile，取得圖片陣列
                                    const parsed = await parseFile(name, mimeType, base64);

                                    if (!parsed.images || parsed.images.length === 0) {
                                        send({ type: 'status', data: `PDF ${name} 解析失敗` });
                                        try {
                                            const fallback = await parseFile(name, mimeType, base64); // 這裡會再進 pdf-parse 分支（你可自行加）
                                            return `[PDF ${name} 文字內容]\n${fallback.content || '無內容'}`;
                                        } catch {
                                            return `[PDF ${name} 解析失敗]`;
                                        }
                                    }

                                    // 取得 VLM 配置（跟單一圖片一樣）
                                    if (!adminConf?.visionModelUrl || !adminConf?.visionModelKey || !adminConf?.visionModelName) {
                                        return `[PDF ${name} 無視覺模型，無法分析圖片]`;
                                    }

                                    const visionBase = adminConf.visionModelUrl.replace(/\/+$/, '').replace(/\/v1$/, '');

                                    send({ type: 'status', data: `PDF ${name} 共 ${parsed.images.length} 頁，開始並行 VLM 分析...` });

                                    // 併發呼叫 VLM（模仿單一圖片）
                                    const pageResults = await Promise.allSettled(
                                        parsed.images.map(async (img) => {
                                            const res = await fetch(`${visionBase}/v1/chat/completions`, {
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
                                                            { type: 'text', text: '請詳細描述這張圖片的內容，包括文字、圖表、表格等所有可見資訊。' },
                                                            { type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } }
                                                        ]
                                                    }],
                                                    max_tokens: 4096,
                                                })
                                            });

                                            if (!res.ok) throw new Error(`VLM failed: ${await res.text()}`);

                                            const json = await res.json();
                                            let rawContent = json.choices?.[0]?.message?.content?.trim() || '（無內容）';

                                            // 過濾思考區塊，只保留最終輸出
                                            rawContent = stripThinkAndKeepFinal(rawContent);

                                            return rawContent;
                                        })
                                    );

                                    // 整理結果，按頁數排序
                                    const summaries = pageResults.map((result, idx) => {
                                        if (result.status === 'fulfilled') {
                                            return result.value;
                                        }
                                        return `（第 ${idx + 1} 頁解析失敗）`;
                                    });

                                    const combined = summaries
                                        .map((desc, idx) => `第 ${idx + 1} 頁：${desc}`)
                                        .join('\n');

                                    return `[PDF ${name} 的詳細內容]\n${combined}`;
                                } else if (isImageFile(name, mimeType)) {
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

                                                let rawContent = visionData.choices?.[0]?.message?.content?.trim() || '（無內容）';

                                                // 過濾思考區塊，只保留最終輸出
                                                rawContent = stripThinkAndKeepFinal(rawContent);
                                                return `[圖片 ${name} 的描述]\n${rawContent}`;
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

                    // ─── 4. MCP Tool Dispatch (3-step: spec → select → call) ────────
                    const mcpResults: string[] = [];

                    if (allMcpTools.length > 0 && adminConf?.taskModelUrl && adminConf?.taskModelKey && adminConf?.taskModelName) {
                        const { fetchMcpToolPayloads, selectMcpTools, callMcpTool } = await import('@/lib/mcp/mcp-dispatch');

                        const userPrompt = messages[messages.length - 1]?.content || '';

                        // Step 1: Fetch OpenAPI specs from all active MCP servers in parallel
                        send({ type: 'status', data: '正在讀取 MCP 工具規範...' });
                        const toolPayloads = await fetchMcpToolPayloads(
                            allMcpTools.map((t: any) => ({
                                id: t.id,
                                url: t.url,
                                path: t.path,
                                key: t.key ?? null,
                            }))
                        );

                        if (toolPayloads.length > 0) {
                            // Step 2: Ask task model which tools to call
                            send({ type: 'status', data: '正在分析 MCP 工具...' });
                            const selectedTools = await selectMcpTools({
                                payloads: toolPayloads,
                                userQuery: userPrompt,
                                taskModelUrl: adminConf.taskModelUrl,
                                taskModelKey: adminConf.taskModelKey,
                                taskModelName: adminConf.taskModelName,
                            }).catch(() => []);

                            // Step 3: Call each selected tool
                            for (const selected of selectedTools) {
                                const toolName = selected.payload.name || selected.tool;
                                send({ type: 'status', data: `正在調用 MCP 工具 [${toolName}]...` });
                                const result = await callMcpTool(selected);
                                if (result.error) {
                                    mcpResults.push(`[MCP 工具 ${toolName} 調用失敗]\n${result.error}`);
                                } else {
                                    const resultText = typeof result.result === 'string'
                                        ? result.result
                                        : JSON.stringify(result.result, null, 2);
                                    mcpResults.push(`[MCP 工具 ${toolName} 回應]\n${resultText}`);
                                }
                            }
                        }
                    }

                    // ─── 5. Build Final Messages ────────────────────────────────────
                    send({ type: 'status', data: '' });

                    const finalMessages: { role: string; content: string }[] = [];

                    // console.log(`data: `, `\n\n以下是本次附加資料的資訊：\n${contextParts.join('\n\n')}`);

                    // System prompt
                    let sysContent = [
                        systemPrompt || '',
                        // contextParts.length > 0 ? `\n\n以下是本次附加資料的上下文資訊：\n${contextParts.join('\n\n')}` : '', // 先註解 因為最後的 user msg 有放了
                        mcpResults.length > 0 ? `\n\n以下是工具查詢結果：\n${mcpResults.join('\n\n')}` : '',
                    ].filter(Boolean).join('');
                    const latestAttachmentEmbed = contextParts.length > 0
                        ? `\n\n[本次附件解析內容]\n${contextParts.join('\n\n')}`
                        : '';

                    // Conversation history
                    // If fileAttachmentSessionOnly is false (default), embed chatFiles parsed content
                    const fileAttachmentSessionOnly = adminConf?.fileAttachmentSessionOnly ?? false;

                    if (!fileAttachmentSessionOnly && attachments.length > 0) {
                        sysContent += `\n\n 除非使用者有特別說明要比較或參考過往附件解析內容，否則輸出內容應以本次附加資料的資訊為主進行回答。`
                    }

                    // console.log(`sysContent: `, sysContent);

                    const sysContentWithoutCurrent = [
                        systemPrompt || '',
                        mcpResults.length > 0 ? `\n\n以下是 MCP Tools 調用後取得的結果：\n${mcpResults.join('\n\n')}` : '',
                    ].filter(Boolean).join('');

                    if (sysContentWithoutCurrent.trim()) {
                        finalMessages.push({ role: 'system', content: sysContentWithoutCurrent.trim() });
                    }

                    if (!fileAttachmentSessionOnly) {
                        // Collect DB IDs from history messages
                        const historyMessageIds = (messages as any[])
                            .map((m: any) => m.id as string)
                            .filter((id: string) => id && UUID_RE.test(id));

                        const filesByMessageId = new Map<string, { name: string; parsedContent: string }[]>();
                        if (historyMessageIds.length > 0) {
                            const files = await db.query.chatFiles.findMany({
                                where: inArray(chatFiles.messageId, historyMessageIds),
                                columns: { messageId: true, name: true, parsedContent: true },
                            });
                            for (const f of files) {
                                if (!f.parsedContent) continue;
                                const arr = filesByMessageId.get(f.messageId) ?? [];
                                arr.push({
                                    name: f.name || 'unknown',
                                    parsedContent: f.parsedContent,
                                });
                                filesByMessageId.set(f.messageId, arr);
                            }
                        }

                        for (let i = 0; i < messages.length; i++) {
                            const m = messages[i];
                            const parts = filesByMessageId.get((m as any).id) ?? [];
                            const historyEmbed = parts.length > 0
                                ? `\n\n[過往附件解析內容]\n${parts.map((p) => `\n${p.parsedContent}`).join('\n\n')}`
                                : '';
                            const currentEmbed = (i === messages.length - 1 && m.role === 'user') ? latestAttachmentEmbed : '';
                            finalMessages.push({ role: m.role, content: m.content + historyEmbed + currentEmbed });
                        }
                    } else {
                        for (let i = 0; i < messages.length; i++) {
                            const m = messages[i];
                            const currentEmbed = (i === messages.length - 1 && m.role === 'user') ? latestAttachmentEmbed : '';
                            finalMessages.push({ role: m.role, content: m.content + currentEmbed });
                        }
                    }

                    // console.log(`finalMessages: `, JSON.stringify(finalMessages))

                    // ─── 6. Quota check (group only) ────────────────────────────────
                    if (providerScope === "group" && providerGroupId) {
                        const [userQuota, modelQuota, groupModelQuota] = await Promise.all([
                            db.query.groupUserQuotas.findFirst({
                                where: and(eq(groupUserQuotas.groupId, providerGroupId), eq(groupUserQuotas.userId, userId)),
                            }),
                            db.query.groupUserModelQuotas.findFirst({
                                where: and(
                                    eq(groupUserModelQuotas.groupId, providerGroupId),
                                    eq(groupUserModelQuotas.userId, userId),
                                    eq(groupUserModelQuotas.model, realModelName || selectedModel)
                                ),
                            }),
                            db.query.groupModelQuotas.findFirst({
                                where: and(
                                    eq(groupModelQuotas.groupId, providerGroupId),
                                    eq(groupModelQuotas.model, realModelName || selectedModel)
                                ),
                            }),
                        ]);

                        if (userQuota?.limitTokens != null) {
                            const window = getQuotaWindow(new Date(), userQuota.refillIntervalHours);
                            const [used] = await db
                                .select({ total: sql<number>`coalesce(sum(${tokenUsage.totalTokens}),0)` })
                                .from(tokenUsage)
                                .where(and(
                                    eq(tokenUsage.groupId, providerGroupId),
                                    eq(tokenUsage.userId, userId),
                                    gte(tokenUsage.createdAt, window.start)
                                ));
                            if ((used?.total || 0) >= userQuota.limitTokens) {
                                send({ type: 'error', data: `群組使用額度已用完，額度恢復日期為${formatQuotaResetTime(window.end)}。` });
                                controller.close();
                                return;
                            }
                        }

                        if (modelQuota?.limitTokens != null) {
                            const window = getQuotaWindow(new Date(), modelQuota.refillIntervalHours);
                            const [usedModel] = await db
                                .select({ total: sql<number>`coalesce(sum(${tokenUsage.totalTokens}),0)` })
                                .from(tokenUsage)
                                .where(and(
                                    eq(tokenUsage.groupId, providerGroupId),
                                    eq(tokenUsage.userId, userId),
                                    eq(tokenUsage.model, realModelName || selectedModel),
                                    gte(tokenUsage.createdAt, window.start)
                                ));
                            if ((usedModel?.total || 0) >= modelQuota.limitTokens) {
                                send({ type: 'error', data: `群組使用額度已用完，額度恢復日期為${formatQuotaResetTime(window.end)}。` });
                                controller.close();
                                return;
                            }
                        }

                        if (groupModelQuota?.limitTokens != null) {
                            const window = getQuotaWindow(new Date(), groupModelQuota.refillIntervalHours);
                            const [usedGroupModel] = await db
                                .select({ total: sql<number>`coalesce(sum(${tokenUsage.totalTokens}),0)` })
                                .from(tokenUsage)
                                .where(and(
                                    eq(tokenUsage.groupId, providerGroupId),
                                    eq(tokenUsage.model, realModelName || selectedModel),
                                    gte(tokenUsage.createdAt, window.start)
                                ));
                            if ((usedGroupModel?.total || 0) >= groupModelQuota.limitTokens) {
                                send({ type: 'error', data: `群組使用額度已用完，額度恢復日期為${formatQuotaResetTime(window.end)}。` });
                                controller.close();
                                return;
                            }
                        }
                    }

                    if (providerScope === "global" && providerGlobalId) {
                        const activeProviderPrefix = (providerConf as any)?.prefix || providerPrefix || "";
                        const roleQuotas = await db.query.globalProviderRoleModelQuotas.findMany({
                            where: and(
                                eq(globalProviderRoleModelQuotas.providerId, providerGlobalId),
                                eq(globalProviderRoleModelQuotas.role, currentUserRole),
                                eq(globalProviderRoleModelQuotas.model, realModelName || selectedModel)
                            ),
                        });

                        for (const quota of roleQuotas) {
                            if (quota.limitTokens == null) continue;
                            const window = getQuotaWindow(new Date(), quota.refillIntervalHours);
                            const [used] = await db
                                .select({ total: sql<number>`coalesce(sum(${tokenUsage.totalTokens}),0)` })
                                .from(tokenUsage)
                                .where(and(
                                    eq(tokenUsage.userId, userId),
                                    eq(tokenUsage.providerPrefix, activeProviderPrefix),
                                    eq(tokenUsage.model, realModelName || selectedModel),
                                    gte(tokenUsage.createdAt, window.start)
                                ));

                            if ((used?.total || 0) >= quota.limitTokens) {
                                send({ type: 'error', data: `該模型可使用額度已用完，額度恢復日期為${formatQuotaResetTime(window.end)}。` });
                                controller.close();
                                return;
                            }
                        }
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

                    // Bump session updatedAt so sidebar order reflects latest activity
                    await db.update(chatSessions)
                        .set({
                            updatedAt: new Date(),
                            systemPrompt: (systemPrompt || '').trim() || null,
                        })
                        .where(eq(chatSessions.id, currentSessionId));

                    // ─── 6b. Save parsed file content to chatFiles (if setting allows) ──
                    if (!adminConf?.fileAttachmentSessionOnly && savedUserMsg?.id && parsedParts.some(p => p)) {
                        const fileInserts = (attachments as any[] || []).map((att: any, idx: number) => ({
                            messageId: savedUserMsg.id,
                            name: att.name,
                            mimeType: att.mimeType,
                            parsedContent: parsedParts[idx] ?? null,
                        })).filter((f: any) => f.parsedContent);
                        if (fileInserts.length > 0) {
                            try { await db.insert(chatFiles).values(fileInserts); } catch { }
                        }
                    }

                    // ─── 7. Stream Main Generation ──────────────────────────────────
                    const requestBody = {
                        model: realModelName || selectedModel,
                        messages: finalMessages,
                        stream: true,
                        stream_options: { include_usage: true },
                    };
                    const fallbackBody = {
                        model: realModelName || selectedModel,
                        messages: finalMessages,
                        stream: true,
                    };

                    let response = await fetch(`${cleanApiUrl}/v1/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${providerConf.apiKey}`
                        },
                        body: JSON.stringify(requestBody)
                    });

                    if (!response.ok && response.status === 400) {
                        response = await fetch(`${cleanApiUrl}/v1/chat/completions`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${providerConf.apiKey}`
                            },
                            body: JSON.stringify(fallbackBody)
                        });
                    }

                    if (!response.ok) {
                        send({ type: 'error', data: `API 錯誤: ${response.status} ${response.statusText}` });
                        controller.close();
                        return;
                    }

                    const reader = response.body?.getReader();
                    const decoder = new TextDecoder();
                    let fullContent = '';
                    let isInReasoningBlock = false;
                    let usageTotals: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;

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
                                    const reasoningDelta =
                                        parsed.choices?.[0]?.delta?.reasoning_content ||
                                        parsed.choices?.[0]?.delta?.reasoning ||
                                        '';
                                    const contentDelta = parsed.choices?.[0]?.delta?.content || '';

                                    if (reasoningDelta) {
                                        if (!isInReasoningBlock) {
                                            isInReasoningBlock = true;
                                            fullContent += '<think>';
                                            send({ type: 'chunk', data: '<think>' });
                                        }
                                        fullContent += reasoningDelta;
                                        send({ type: 'chunk', data: reasoningDelta });
                                    }

                                    if (contentDelta) {
                                        if (isInReasoningBlock) {
                                            isInReasoningBlock = false;
                                            fullContent += '</think>';
                                            send({ type: 'chunk', data: '</think>' });
                                        }
                                        fullContent += contentDelta;
                                        send({ type: 'chunk', data: contentDelta });
                                    }
                                    const usage = parsed.usage;
                                    if (usage) {
                                        const promptTokens = Number(usage.prompt_tokens ?? usage.promptTokens ?? 0);
                                        const completionTokens = Number(usage.completion_tokens ?? usage.completionTokens ?? 0);
                                        const totalTokens = Number(usage.total_tokens ?? usage.totalTokens ?? (promptTokens + completionTokens));
                                        usageTotals = { promptTokens, completionTokens, totalTokens };
                                    }
                                } catch { }
                            }
                        }

                        if (isInReasoningBlock) {
                            isInReasoningBlock = false;
                            fullContent += '</think>';
                            send({ type: 'chunk', data: '</think>' });
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

                    const usagePayload = {
                        groupId: providerGroupId,
                        userId,
                        sessionId: currentSessionId,
                        providerPrefix: providerPrefix || (providerConf as any)?.prefix || null,
                        model: realModelName || selectedModel,
                        promptTokens: usageTotals?.promptTokens || 0,
                        completionTokens: usageTotals?.completionTokens || 0,
                        totalTokens: usageTotals?.totalTokens || 0,
                    };

                    if (providerGroupId && usageTotals) {
                        try {
                            await db.insert(groupTokenUsage).values(usagePayload as any);
                        } catch { }
                    }
                    if (usageTotals) {
                        try {
                            await db.insert(tokenUsage).values(usagePayload as any);
                        } catch { }
                    }

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

    // Only generate a title for brand-new sessions (title === 'New Chat')
    const existing = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, sessionId),
        columns: { title: true }
    });
    if (existing?.title && existing.title !== 'New Chat') return;

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
