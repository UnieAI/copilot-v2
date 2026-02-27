"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import LoadingSpinner from "@/components/shared/loading-spinner"

export default function Page() {
  const [isLoading, setIsLoading] = useState(false)

  const handleToggleLoading = () => {
    setIsLoading(!isLoading)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Loading Spinner 組件</h1>
        <Button onClick={handleToggleLoading}>{isLoading ? "停止 Loading" : "開始 Loading"}</Button>
      </div>

      {/* 使用示例 */}
      <Card>
        <CardHeader>
          <CardTitle>使用示例</CardTitle>
          <CardDescription>在實際場景中的使用方式</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-8 border rounded-lg text-center">
            {isLoading ? (
              <div className="flex flex-col items-center space-y-4">
                <LoadingSpinner size="lg" />
                <p className="text-gray-600">載入中...</p>
              </div>
            ) : (
              <p className="text-gray-600">點擊上方按鈕開始載入</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 不同樣式展示 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Default (圖標)</CardTitle>
            <CardDescription>使用 Lucide React 的 Loader2 圖標</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center space-x-4 py-8">
            <LoadingSpinner size="sm" />
            <LoadingSpinner size="md" />
            <LoadingSpinner size="lg" />
            <LoadingSpinner size="xl" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ring (圓環)</CardTitle>
            <CardDescription>純 CSS 圓環旋轉動畫</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center space-x-4 py-8">
            <LoadingSpinner variant="ring" size="sm" />
            <LoadingSpinner variant="ring" size="md" />
            <LoadingSpinner variant="ring" size="lg" />
            <LoadingSpinner variant="ring" size="xl" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dots (點點)</CardTitle>
            <CardDescription>三個點的跳躍動畫</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center space-x-8 py-8">
            <LoadingSpinner variant="dots" size="sm" />
            <LoadingSpinner variant="dots" size="md" />
            <LoadingSpinner variant="dots" size="lg" />
            <LoadingSpinner variant="dots" size="xl" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pulse (脈衝)</CardTitle>
            <CardDescription>圓形脈衝動畫</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center space-x-4 py-8">
            <LoadingSpinner variant="pulse" size="sm" />
            <LoadingSpinner variant="pulse" size="md" />
            <LoadingSpinner variant="pulse" size="lg" />
            <LoadingSpinner variant="pulse" size="xl" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Circle Dots (圓點環)</CardTitle>
            <CardDescription>圓形排列的點陣旋轉動畫</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center space-x-8 py-8">
            <LoadingSpinner variant="circle-dots" size="sm" />
            <LoadingSpinner variant="circle-dots" size="md" />
            <LoadingSpinner variant="circle-dots" size="lg" />
            <LoadingSpinner variant="circle-dots" size="xl" />
          </CardContent>
        </Card>
      </div>

      {/* 自定義顏色示例 */}
      <Card>
        <CardHeader>
          <CardTitle>自定義顏色</CardTitle>
          <CardDescription>使用 className 自定義顏色</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center space-x-4 py-8">
          <LoadingSpinner className="text-blue-500" size="lg" />
          <LoadingSpinner variant="ring" className="border-t-red-500" size="lg" />
          <LoadingSpinner variant="dots" className="[&>div]:bg-green-500" size="lg" />
          <LoadingSpinner variant="pulse" className="bg-purple-500" size="lg" />
          <LoadingSpinner variant="circle-dots" className="[&>div]:bg-orange-500" size="lg" />
        </CardContent>
      </Card>

      {/* 代碼示例 */}
      <Card>
        <CardHeader>
          <CardTitle>使用方法</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg font-mono text-sm">
            <div className="space-y-2">
              <div>{"// 基本使用"}</div>
              <div>{"<LoadingSpinner />"}</div>
              <div className="mt-4">{"// 不同大小"}</div>
              <div>{'<LoadingSpinner size="lg" />'}</div>
              <div className="mt-4">{"// 不同樣式"}</div>
              <div>{'<LoadingSpinner variant="ring" />'}</div>
              <div className="mt-4">{'<LoadingSpinner variant="circle-dots" />'}</div>
              <div className="mt-4">{"// 自定義樣式"}</div>
              <div>{'<LoadingSpinner className="text-blue-500" />'}</div>
              <div className="mt-4">{"// 在條件渲染中使用"}</div>
              <div>{"{"}</div>
              <div className="ml-4">{"isLoadingDB ? ("}</div>
              <div className="ml-8">{'<LoadingSpinner size="lg" />'}</div>
              <div className="ml-4">{"） : ("}</div>
              <div className="ml-8">{"// 你的內容"}</div>
              <div className="ml-4">{")"}</div>
              <div>{"}"}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
