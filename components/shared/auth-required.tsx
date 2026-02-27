import Link from "next/link"
import { DotBackgroundWithBlurRay } from "./dot-background-with-blur-ray"

export default function AuthRequired() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black flex items-center justify-center p-4">
      <DotBackgroundWithBlurRay />
      <div className="max-w-md w-full text-center space-y-8">
        {/* 圖示或 Logo */}
        <div className="mx-auto w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-2xl">
          <svg
            className="w-12 h-12 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            請先登入
          </h1>
          <p className="text-slate-400 text-lg">
            需要登入帳號才能建立角色
          </p>
        </div>

        <div className="pt-4">
          <Link
            href="/api/auth/signin"
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-300 transform hover:scale-[1.02] active:scale-95"
          >
            立即登入
          </Link>
        </div>

        <p className="text-slate-500 text-sm pt-8">
          還沒有帳號？{" "}
          <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            立即註冊
          </Link>
        </p>
      </div>
    </div>
  )
}