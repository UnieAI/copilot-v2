'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
    Users, MessageSquare, Gamepad2,
    ArrowRight, Sparkles
} from 'lucide-react'
import { DotBackgroundWithBlurRay } from '@/components/shared/dot-background-with-blur-ray'

export const HomePage = () => {
    const router = useRouter()

    return (
        <div className="relative min-h-screen overflow-hidden">
            {/* 背景 */}
            <DotBackgroundWithBlurRay />

            {/* 內容 */}
            <div className="relative z-10 container mx-auto px-6 py-12 md:py-20 max-w-6xl">
                {/* 標題區 */}
                <div className="text-center mb-16 md:mb-20">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <Sparkles className="h-8 w-8 text-purple-500" />
                        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 bg-clip-text text-transparent">
                            多人 AI 聊天室
                        </h1>
                    </div>
                    <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                        與AI角色互動、開啟群聊、挑戰趣味遊戲
                    </p>
                </div>

                {/* 三個主要分區 */}
                <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
                    {/* 角色設定區 */}
                    <div className="group bg-gradient-to-br from-zinc-900/70 to-zinc-950/70 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-8 hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-purple-500/20 rounded-xl">
                                <Users className="h-7 w-7 text-purple-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">角色設定</h2>
                        </div>

                        <p className="text-zinc-400 mb-8 leading-relaxed">
                            建立、編輯、客製化你的專屬AI角色<br />
                            設定個性、外貌、背景故事、語氣...
                        </p>

                        <Button
                            onClick={() => router.push('/character')}
                            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-500/20 group-hover:scale-[1.02] transition-transform"
                        >
                            進入角色管理
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>

                    {/* 聊天區域 */}
                    <div className="group bg-gradient-to-br from-zinc-900/70 to-zinc-950/70 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-8 hover:border-green-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-green-500/20 rounded-xl">
                                <MessageSquare className="h-7 w-7 text-green-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">聊天室</h2>
                        </div>

                        <p className="text-zinc-400 mb-6 leading-relaxed">
                            與AI角色一對一對話<br />
                            或加入多人聊天室一起互動
                        </p>

                        <div className="space-y-4">
                            <Button
                                onClick={() => router.push('/chat-room')}
                                variant="outline"
                                className="w-full border-green-600/40 hover:bg-green-950/40 text-green-300 hover:text-green-200"
                            >
                                進階角色聊天室
                            </Button>
                            <Button
                                onClick={() => router.push('/simple-chat-room')}
                                variant="outline"
                                className="w-full border-emerald-600/40 hover:bg-emerald-950/40 text-emerald-300 hover:text-emerald-200"
                            >
                                簡易聊天室
                            </Button>
                        </div>
                    </div>

                    {/* 遊戲區域 */}
                    <div className="group bg-gradient-to-br from-zinc-900/70 to-zinc-950/70 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-8 hover:border-pink-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-pink-500/10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-pink-500/20 rounded-xl">
                                <Gamepad2 className="h-7 w-7 text-pink-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">遊戲區域</h2>
                        </div>

                        <p className="text-zinc-400 mb-8 leading-relaxed">
                            輕鬆有趣的互動小遊戲<br />
                            目前開放：
                        </p>

                        <div className="space-y-4">
                            
                        </div>
                    </div>
                </div>

                {/* 可選：未來功能提示 */}
                <div className="mt-16 text-center text-zinc-500 text-sm">
                    更多角色、更多聊天模式、更多遊戲即將上線...
                </div>
            </div>
        </div>
    )
}