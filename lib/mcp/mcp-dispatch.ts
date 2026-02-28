/**
 * MCP Tool Dispatch — Server-side only (Node/Edge runtime)
 *
 * Step 1: fetchMcpToolPayloads  — fetch OpenAPI spec from each MCP server and convert to ToolPayload[]
 * Step 2: selectMcpTools        — use task model to decide which tools to call and with what args
 * Step 3: callMcpTool           — actually HTTP-invoke the chosen tools and return results
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToolPayload {
    type: "function";
    name?: string;
    description: string;
    method: string;   // e.g. "POST"
    path: string;     // e.g. "/get_ming_pan"
    parameters: {
        type: "object" | "array";
        properties?: Record<string, { type?: string; description?: string }>;
        required?: string[];
        items?: any;
    };
    /** The MCP tool row from DB — attached for later auth/URL lookup */
    baseTool: {
        id: string;
        url: string;
        path: string;
        key: string | null;
    };
}

export interface SelectedTool {
    tool: string;        // operationId
    args: Record<string, any>;
    payload: ToolPayload; // resolved payload from step 1
}

export interface McpCallResult {
    tool: string;
    args: Record<string, any>;
    result?: any;
    error?: string;
}

// ─── Step 1: Fetch OpenAPI specs & build ToolPayload[] ───────────────────────

function resolveSchema(schema: any, components: any): any {
    if (schema?.$ref) {
        const parts = schema.$ref.replace(/^#\/components\//, "").split("/");
        let resolved: any = components;
        for (const part of parts) resolved = resolved?.[part];
        return resolveSchema(resolved, components);
    }
    return schema;
}

function convertOpenAPIToToolPayloads(
    spec: any,
    baseTool: ToolPayload["baseTool"]
): ToolPayload[] {
    const payloads: ToolPayload[] = [];
    const components = spec.components || {};

    for (const path in spec.paths ?? {}) {
        for (const method in spec.paths[path]) {
            const op = spec.paths[path][method];
            const tool: ToolPayload = {
                type: "function",
                name: op.operationId,
                description: op.description || op.summary || "No description.",
                method: method.toUpperCase(),
                path,
                parameters: { type: "object", properties: {}, required: [] },
                baseTool,
            };

            // Path / query parameters
            for (const param of op.parameters ?? []) {
                const schema = param.schema || {};
                (tool.parameters.properties as any)[param.name] = {
                    type: schema.type,
                    description: schema.description || "",
                };
                if (param.required) tool.parameters.required!.push(param.name);
            }

            // Request body
            const jsonSchema = op.requestBody?.content?.["application/json"]?.schema;
            if (jsonSchema) {
                const resolved = resolveSchema(jsonSchema, components);
                if (resolved.type === "object" && resolved.properties) {
                    Object.assign(tool.parameters.properties!, resolved.properties);
                    if (resolved.required) {
                        tool.parameters.required = Array.from(
                            new Set([...(tool.parameters.required ?? []), ...resolved.required])
                        );
                    }
                } else if (resolved.type === "array") {
                    tool.parameters = resolved;
                }
            }

            payloads.push(tool);
        }
    }
    return payloads;
}

/**
 * Step 1 — Fetches OpenAPI spec from each active MCP tool and converts to ToolPayload[].
 * All fetches run in parallel.
 */
export async function fetchMcpToolPayloads(
    enabledTools: Array<{ id: string; url: string; path: string; key: string | null }>
): Promise<ToolPayload[]> {
    const results = await Promise.all(
        enabledTools.map(async (tool) => {
            const specUrl = `${tool.url.replace(/\/+$/, "")}/${tool.path.replace(/^\//, "")}`;
            try {
                const headers: Record<string, string> = { "Content-Type": "application/json" };
                if (tool.key) headers["Authorization"] = `Bearer ${tool.key}`;

                const res = await fetch(specUrl, { headers, signal: AbortSignal.timeout(8000) });
                if (!res.ok) {
                    console.warn(`[MCP] Failed to fetch spec from ${specUrl}: ${res.status}`);
                    return null;
                }
                const spec = await res.json();
                return convertOpenAPIToToolPayloads(spec, tool);
            } catch (e: any) {
                console.warn(`[MCP] Error fetching spec from ${specUrl}: ${e.message}`);
                return null;
            }
        })
    );

    return results
        .filter((r): r is ToolPayload[] => r !== null)
        .flat();
}

// ─── Step 2: Use task model to select tools ───────────────────────────────────

/**
 * Step 2 — Asks the task model which tools to call.
 * Returns a list of { tool (operationId), args, payload } objects.
 */
export async function selectMcpTools(opts: {
    payloads: ToolPayload[];
    userQuery: string;
    taskModelUrl: string;
    taskModelKey: string;
    taskModelName: string;
}): Promise<SelectedTool[]> {
    const { payloads, userQuery, taskModelUrl, taskModelKey, taskModelName } = opts;

    const toolsText = payloads.map(t => {
        const required = t.parameters.required?.length
            ? `Required: ${t.parameters.required.join(", ")}`
            : "Required: (none)";
        const properties = Object.entries(t.parameters.properties ?? {})
            .map(([k, v]) => `  - ${k}: ${v.type ?? "any"} — ${v.description ?? ""}`)
            .join("\n");
        return `Tool Name: ${t.name}\nDescription: ${t.description}\n${required}\nFields:\n${properties}`;
    }).join("\n\n");

    const systemPrompt = `You are an intelligent assistant with access to the following tools.

# Your task:
1. Read the user's request.
2. Decide which tools are relevant.
3. Respond with a JSON array containing the tool name and args.
4. If no tools are relevant, return an empty array: []

# STRICT RULES:
- Use ONLY the listed parameter names exactly as written.
- Do NOT include extra fields, comments or explanations.
- Valid JSON only.
- You may return more than one tool.

# TOOLS:
${toolsText}

# Respond ONLY with valid JSON:
[
  { "tool": "tool_name", "args": { "field1": "value" } }
]`;

    const taskBase = taskModelUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
    const res = await fetch(`${taskBase}/v1/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${taskModelKey}`,
        },
        body: JSON.stringify({
            model: taskModelName,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userQuery },
            ],
            stream: false,
            temperature: 0,
        }),
    });

    if (!res.ok) {
        console.warn(`[MCP] Task model returned ${res.status}`);
        return [];
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "[]";
    // Strip <think> blocks
    const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];

    try {
        const parsed: Array<{ tool: string; args: Record<string, any> }> = JSON.parse(match[0]);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map(item => {
                const payload = payloads.find(p => p.name === item.tool);
                if (!payload) return null;
                return { tool: item.tool, args: item.args ?? {}, payload };
            })
            .filter((x): x is SelectedTool => x !== null);
    } catch {
        console.warn("[MCP] Failed to parse tool selection JSON");
        return [];
    }
}

// ─── Step 3: Call the MCP HTTP endpoint ──────────────────────────────────────

/**
 * Step 3 — Performs the actual HTTP call to the MCP tool endpoint.
 */
export async function callMcpTool(selected: SelectedTool): Promise<McpCallResult> {
    const { tool, args, payload } = selected;
    const { method, path, baseTool } = payload;
    const upperMethod = method.toUpperCase();

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (baseTool.key) headers["Authorization"] = `Bearer ${baseTool.key}`;

    // Substitute path parameters: /items/{id} → /items/42
    let resolvedPath = path;
    for (const [key, value] of Object.entries(args)) {
        if (resolvedPath.includes(`{${key}}`)) {
            resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(String(value)));
        }
    }

    let requestUrl = `${baseTool.url.replace(/\/+$/, "")}${resolvedPath}`;
    let fetchOptions: RequestInit = { method: upperMethod, headers };

    if (upperMethod === "GET" || upperMethod === "HEAD") {
        // Remaining args (not consumed as path params) → query string
        const query: Record<string, string> = {};
        for (const [key, value] of Object.entries(args)) {
            if (!path.includes(`{${key}}`)) query[key] = String(value);
        }
        if (Object.keys(query).length > 0) {
            requestUrl += "?" + new URLSearchParams(query).toString();
        }
    } else {
        fetchOptions.body = JSON.stringify(args);
    }

    try {
        const res = await fetch(requestUrl, fetchOptions);
        const text = await res.text();
        let result: any;
        try { result = text ? JSON.parse(text) : {}; } catch { result = text; }

        if (!res.ok) {
            return { tool, args, error: `HTTP ${res.status}: ${typeof result === "string" ? result : JSON.stringify(result).slice(0, 300)}` };
        }
        return { tool, args, result };
    } catch (e: any) {
        return { tool, args, error: String(e) };
    }
}
