import { DotBackgroundWithBlurRay } from "./dot-background-with-blur-ray";

export default function AuthLoading() {
  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50">
      <DotBackgroundWithBlurRay />
      <div className="flex flex-col items-center gap-8">
        {/* 旋轉 + 脈動的載入指示器 */}
        <div className="relative w-20 h-20">
          {/* 外圈旋轉 */}
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
          
          {/* 中間較慢的旋轉 */}
          <div className="absolute inset-2 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-[spin_2.5s_linear_infinite]"></div>
          
          {/* 中心脈動光點 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 animate-pulse"></div>
          </div>
        </div>

        {/* 文字區域 */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Loading...
          </h2>
          <p className="text-slate-400 text-sm">
            Just a moment...
          </p>
        </div>
      </div>
    </div>
  )
}