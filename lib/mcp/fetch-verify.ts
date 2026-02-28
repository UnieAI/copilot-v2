"use client"

/**
 * Verify that a MCP tool endpoint is reachable.
 * Calls /api/verify which proxies the request server-side.
 */
export const fetchVerify = async (apiKey: string, url: string): Promise<boolean> => {
    try {
        const response = await fetch(`/api/verify`, {
            method: "POST",
            headers: {
                Authorization: apiKey ? `Bearer ${apiKey}` : "",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ url }),
        })
        if (!response.ok) return false
        const data = await response.json()
        return data?.ok === true
    } catch {
        return false
    }
}
