import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { apiUrl, apiKey } = await req.json()

    if (!apiUrl || !apiKey) {
      return NextResponse.json({ error: "API URL 和 API Key 是必需的" }, { status: 400 })
    }

    // 測試連接並獲取模型列表
    const modelsUrl = `${apiUrl}/v1/models`

    const response = await fetch(modelsUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("API Error:", response.status, errorText)

      let errorMessage = "API 連接失敗"
      if (response.status === 401) {
        errorMessage = "API Key 無效或已過期"
      } else if (response.status === 404) {
        errorMessage = "API URL 不正確或不支援 /v1/models 端點"
      } else if (response.status >= 500) {
        errorMessage = "API 服務器錯誤"
      }

      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    const data = await response.json()

    // 檢查返回的數據格式
    if (!data.data || !Array.isArray(data.data)) {
      return NextResponse.json({ error: "API 返回的數據格式不正確" }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      models: data.data,
      message: `成功連接，找到 ${data.data.length} 個模型`,
    })
  } catch (error) {
    console.error("Connection test error:", error)
    return NextResponse.json({ error: "連接測試失敗，請檢查網路連接和 API 設定" }, { status: 500 })
  }
}
