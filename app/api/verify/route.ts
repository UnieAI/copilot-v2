import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/verify
 * Proxy-tests whether an MCP tool endpoint is reachable.
 * Body: { url: string }
 * Header: Authorization: Bearer <apiKey>
 */
export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json()
        if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 })

        const authorization = req.headers.get("Authorization") || ""

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        }
        if (authorization) headers["Authorization"] = authorization

        const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })

        if (!res.ok) {
            return NextResponse.json({ ok: false, status: res.status }, { status: 200 })
        }

        const data = await res.json().catch(() => ({}))
        return NextResponse.json({ ok: true, data })
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
    }
}
