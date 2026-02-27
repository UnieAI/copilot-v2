import React, { useState, useEffect, useRef } from "react"

import type { CharacterChatType, ChatMessage } from "@/utils/chat-room/type"
import { MessagesSquare, User, ChevronDown } from "lucide-react"
import Image from "next/image"
import { cn } from "../../../../lib/utils"

import { ReasoningBlock } from "@/components/shared/reasoning-block"
import { isTempCharacter } from "@/utils/chat-room"

interface Props {
    allMessages: ChatMessage[];
    userCharacter: CharacterChatType | null;
    isAutoScrolling: boolean;
    setIsAutoScrolling: React.Dispatch<React.SetStateAction<boolean>>;
}

export const MessageRender = ({
    allMessages,
    userCharacter,
    isAutoScrolling,
    setIsAutoScrolling,
}: Props) => {

    // -------------------------- ▽ 滾動功能 ▽ -------------------------- //

    const [showScrollToBottom, setShowScrollToBottom] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // 按鈕滾動到最下方
    useEffect(() => {
        const chatContainer = chatContainerRef.current;
        const messagesEnd = messagesEndRef.current;

        if (!chatContainer || !messagesEnd) return;

        let observer: IntersectionObserver;

        const logContainerInfo = (isEndVisible?: boolean) => {
            const scrollHeight = chatContainer.scrollHeight;
            const scrollTop = chatContainer.scrollTop;
            const clientHeight = chatContainer.clientHeight;

            const distanceToBottom = scrollHeight - scrollTop - clientHeight;
            const isAtBottom = Math.abs(distanceToBottom) < 1;

            const containerRect = chatContainer.getBoundingClientRect();
            const endRect = messagesEnd.getBoundingClientRect();

            const computedIsEndVisible = typeof isEndVisible !== 'undefined'
                ? isEndVisible
                : (endRect.top >= containerRect.top && endRect.bottom <= containerRect.bottom);

            // console.log('容器總高度 (scrollHeight):', scrollHeight);
            // console.log('滾動位置 (scrollTop):', scrollTop);
            // console.log('可視區域高度 (clientHeight):', clientHeight);
            // console.log('距離底部還有:', distanceToBottom);
            // console.log('是否已經在底部:', isAtBottom);
            // console.log('messagesEndRef 是否可見:', computedIsEndVisible);
            // console.log('-----------------------');

            if (computedIsEndVisible) {
                setShowScrollToBottom(false);
            } else {
                setShowScrollToBottom(!isAtBottom);
            }
        };

        // IntersectionObserver 用來觀察 messagesEndRef 是否可見
        observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    logContainerInfo(entry.isIntersecting);
                });
            },
            {
                root: chatContainer,
                threshold: 0.1, // 可視區域佔比，0.1 表示至少 10% 可見就算可見
            }
        );

        observer.observe(messagesEnd);

        const handleScroll = () => {
            logContainerInfo();
        };

        chatContainer.addEventListener('scroll', handleScroll);

        const resizeObserver = new ResizeObserver(() => {
            logContainerInfo();
        });

        resizeObserver.observe(chatContainer);

        // 頁面初始化時先執行一次
        logContainerInfo();

        return () => {
            chatContainer.removeEventListener('scroll', handleScroll);
            resizeObserver.disconnect();
            observer.disconnect();
        };
    }, [allMessages]);

    // 生成訊息時 自動滾動到最下方
    useEffect(() => {
        if (!isAutoScrolling) return;

        const chatContainer = chatContainerRef.current;
        if (!chatContainer) return;

        let animationFrameId: number;

        const scrollSmoothly = () => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            animationFrameId = requestAnimationFrame(scrollSmoothly);
        };

        const handleWheel = (event: WheelEvent) => {
            // 判斷是否在 chatContainer 範圍內滾動
            if (chatContainer.contains(event.target as Node)) {
                setIsAutoScrolling(false);
            }
        };

        scrollSmoothly(); // 啟動初次 scroll
        window.addEventListener('wheel', handleWheel, { passive: true });

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('wheel', handleWheel);
        };
    }, [isAutoScrolling]);

    // -------------------------- △ 滾動功能 △ -------------------------- //

    return (
        <div className="flex-1 overflow-hidden">
            {allMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                    <div className="text-center text-zinc-500">
                        <MessagesSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">聊天室準備就緒</p>
                        <p className="text-sm">
                            {userCharacter ? "你將首先發言，然後其他角色會依序回應" : "點擊開始按鈕讓角色們開始對話"}
                        </p>
                    </div>
                </div>
            ) : (
                <div ref={chatContainerRef} className="h-full p-4 overflow-y-auto scrollbar-hide">
                    <div className="space-y-4 max-w-4xl mx-auto">
                        {allMessages.map((message) => (
                            <div key={message.id} className={cn("flex gap-3", message.isUser ? "flex-row-reverse" : "")}>
                                {/* AI角色頭像 */}
                                {!message.isUser && (
                                    <div className="flex-shrink-0">
                                        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center">
                                            {isTempCharacter(message.character) ? (
                                                <User className="w-6 h-6 text-zinc-600" />
                                            ) : (
                                                <Image
                                                    src={message.character.CharacterType.image || "/placeholder.svg"}
                                                    alt={message.character.CharacterType.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className={cn("flex flex-col", message.isUser ? "items-end" : "items-start")}>
                                    {/* AI角色姓名 */}
                                    {!message.isUser && (
                                        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 px-1">
                                            {message.character.CharacterType.name}
                                        </div>
                                    )}

                                    {/* 對話框 */}
                                    <div
                                        className={cn(
                                            "max-w-md px-4 py-2 rounded-2xl shadow-sm",
                                            message.isUser
                                                ? "bg-white text-black dark:bg-zinc-800 dark:text-white rounded-br-md"
                                                : "bg-green-500 text-black border rounded-tl-md",
                                        )}
                                    >
                                        {message.isWaiting ? (
                                            <div className="flex items-center gap-1">
                                                <span className="text-sm text-black">正在思考</span>
                                                <div className="flex gap-1">
                                                    <div
                                                        className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce"
                                                        style={{ animationDelay: "0ms" }}
                                                    ></div>
                                                    <div
                                                        className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce"
                                                        style={{ animationDelay: "150ms" }}
                                                    ></div>
                                                    <div
                                                        className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce"
                                                        style={{ animationDelay: "300ms" }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <ReasoningBlock reason={message.reason} />
                                                <p className="text-sm leading-relaxed">{message.content}</p>
                                            </>
                                        )}
                                    </div>

                                    {/* 時間戳 */}
                                    <div className={cn("text-xs text-zinc-400 mt-1 px-1", message.isUser ? "text-right" : "text-left")}>
                                        {message.timestamp.toLocaleTimeString("zh-TW", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {showScrollToBottom && allMessages.length > 0 && !isAutoScrolling && (
                        <button
                            onClick={() => { setIsAutoScrolling(true) }}
                            className="sticky bg-black dark:bg-white opacity-40 hover:opacity-60 text-zinc-500 p-3 shadow-lg z-50"
                            style={{
                                borderRadius: '9999px',
                                bottom: '0%',
                                transform: 'translateX(0%)',
                            }}
                        >
                            <ChevronDown className="h-3 w-3" />
                        </button>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            )}
        </div>
    )
}