"use client"

import { useEffect, useState, useRef } from "react"
import type { Message } from "@/utils/llm/type"
import { initialCharacter, type CharacterType } from "@/utils/character/type"
import type { CharacterChatType, ChatroomPromptSettings, ChatMessage } from "@/utils/chat-room/type"
import { PersonalityReplyStyles } from "@/utils/character"
import { Gender, BloodType, PersonalityType } from "@/utils/character"
import { MessagesSquare, ArrowRight } from "lucide-react"
import { cn } from "../../../lib/utils"
import { isDevelopment } from "@/utils"

import { safeParseJson } from "@/utils/llm/functions"

import type { ParsedContent } from "@/utils/llm/type"
import { parseContent } from "@/utils/llm/functions"

import { Step1 } from "@/components/page/chat-room/step1"
import { Step2 } from "@/components/page/chat-room/step2"
import { Step3 } from "@/components/page/chat-room/step3"
import { ActionGetUserApiSettings } from "@/app/(main)/actions"
import { Session } from "next-auth"
import { ApiSettings } from "@/utils/settings/type"
import { useRouter } from "next/navigation"

import { ActionGetCharactersByUser } from "@/app/(main)/actions"
import { toast } from "sonner"

export const ChatRoomForm = ({
    session
}: {
    session: Session
}) => {
    const [step, setStep] = useState<number>(1)
    const [isLoadingDB, setIsLoadingDB] = useState<boolean>(true)
    const [characters, setCharacters] = useState<CharacterType[]>([])
    const [selected, setSelected] = useState<Record<string, boolean>>({})
    const [selectedOrder, setSelectedOrder] = useState<string[]>([]) // 記錄選擇順序
    const [motionSettings, setMotionSettings] = useState<Record<string, boolean>>({}) // 追蹤每個角色的動作設定
    const [selectedCharacters, setSelectedCharacters] = useState<CharacterChatType[]>([])
    const [includeUser, setIncludeUser] = useState<boolean>(false)
    const [isThinkingRespond, setIsThinkingRespond] = useState<boolean>(false)
    const [useExistingCharacter, setUseExistingCharacter] = useState<boolean>(true)
    const [selectedUserCharacter, setSelectedUserCharacter] = useState<string>("")
    const [userCharacter, setUserCharacter] = useState<CharacterChatType | null>(null) // 用戶角色
    const [tempCharacter, setTempCharacter] = useState<CharacterType>(initialCharacter)

    const [promptSettings, setPromptSettings] = useState<ChatroomPromptSettings>({
        scene: "",
        topic: "",
        tone: "",
        objective: "",
        style: "",
    })

    const [chatMap, setChatMap] = useState<Record<string, Message[]>>({})
    const [activeIndex, setActiveIndex] = useState<number>(0)
    const [isPlaying, setIsPlaying] = useState<boolean>(false)
    const [currentSpeaker, setCurrentSpeaker] = useState<string>("")
    const [isGenerating, setIsGenerating] = useState<boolean>(false)
    const [isWaitingForUser, setIsWaitingForUser] = useState<boolean>(false) // 等待用戶輸入
    const [userInput, setUserInput] = useState<string>("") // 用戶輸入內容
    const abortControllerRef = useRef<AbortController | null>(null)
    const [allMessages, setAllMessages] = useState<ChatMessage[]>([])

    // 生成內容時 自動滾動功能
    const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(false);

    const router = useRouter()
    const [settings, setSettings] = useState<ApiSettings>({
        apiUrl: "",
        apiKey: "",
        selectedModel: "",
    })

    useEffect(() => {
        (async () => {
            try {
                const apiData = await ActionGetUserApiSettings(session.user.id);
                if (apiData) {
                    setSettings(apiData);
                } else {
                    router.push('/settings')
                }
            } catch (err) {
                console.error("載入 API 設定失敗", err);
                router.push('/settings');
            }
        })();
    }, []);

    const generateSystemPrompt = (character: CharacterChatType, otherCharacters: CharacterChatType[]) => {
        const char = character.CharacterType
        const basicInfo = `你是 ${char.name}，
性別為 ${char.gender}，
生日是 ${char.birthday}，
星座為 ${char.zodiac}，
血型為 ${char.bloodType} 型。
你的人格類型是 ${char.personality}，
特質是：${PersonalityReplyStyles[char.mbti]}。`

        const personalityInfo = char.systemPrompt || ""

        const otherNames = otherCharacters
            .filter((c) => c.CharacterType.id !== char.id)
            .map((c) => c.CharacterType.name)
            .join("、")

        const sceneInfo = promptSettings.scene ? `場景：${promptSettings.scene}。` : ""
        const topicInfo = promptSettings.topic ? `對話主題：${promptSettings.topic}。` : ""
        const toneInfo = promptSettings.tone ? `語氣風格：${promptSettings.tone}。` : ""
        const objectiveInfo = promptSettings.objective ? `對話目標：${promptSettings.objective}。` : ""
        const styleInfo = promptSettings.style ? `詳細描述：${promptSettings.style}。` : ""

        const motionRule = character.use_motion
            ? "- 你可以在對話中適當加入動作描述，用括號包圍，例如：(微笑)、(點頭)等。"
            : "- **禁止敘述動作、表情、內心戲或旁白**"

        const formatRule = `
你正在和 ${otherNames} 聊天。

你必須以自己(${char.name})的視角與立場，**用對話語句（類似LINE訊息）**與其他人互動。

**嚴格規範如下：**
- 只能寫出你要說的話
- **禁止創作他人的對話或任何角色的發言**
${motionRule}
- 不可模擬場景或使用小說敘述風格

- 錯誤範例（禁止）：
John：你怎麼看？
Amy：我沒事。
我轉過頭，看著她說：「不要這樣想。」

請謹記：你不是導演，也不是旁白，你是${char.name}。
你只需自然地回應你應該說的話。`

        return `${basicInfo}
${personalityInfo}
${sceneInfo}
${topicInfo}
${toneInfo}
${objectiveInfo}
${styleInfo}
${formatRule}`
    }
    const shouldRespondSystemPrompt = (character: CharacterChatType, otherCharacters: CharacterChatType[]) => {
        const char = character.CharacterType
        const basicInfo = `你是 ${char.name}，
性別為 ${char.gender}，
生日是 ${char.birthday}，
星座為 ${char.zodiac}，
血型為 ${char.bloodType} 型。
你的人格類型是 ${char.personality}，
特質是：${PersonalityReplyStyles[char.mbti]}。`

        const personalityInfo = char.systemPrompt || ""

        const otherNames = otherCharacters
            .filter((c) => c.CharacterType.id !== char.id)
            .map((c) => c.CharacterType.name)
            .join("、")

        const sceneInfo = promptSettings.scene ? `場景：${promptSettings.scene}。` : ""
        const topicInfo = promptSettings.topic ? `對話主題：${promptSettings.topic}。` : ""
        const toneInfo = promptSettings.tone ? `語氣風格：${promptSettings.tone}。` : ""
        const objectiveInfo = promptSettings.objective ? `對話目標：${promptSettings.objective}。` : ""
        const styleInfo = promptSettings.style ? `詳細描述：${promptSettings.style}。` : ""

        const formatRule = `
你正在和 ${otherNames} 聊天。

你必須以自己(${char.name})的視角與立場，**判斷並決定是否要回應他人訊息的內容**。

**嚴格規範如下：**
- 如果你覺得你應該回應，請只回傳：
{"respond": true}

- 如果你不想回應，請只回傳：
{"respond": false}

- **嚴格遵守JSON格式**，不要加任何解釋、註解或其他語句。。`

        return `${basicInfo}
${personalityInfo}
${sceneInfo}
${topicInfo}
${toneInfo}
${objectiveInfo}
${styleInfo}
${formatRule}`
    }

    const startConversation = () => {
        // 初始化每個角色的消息陣列（除了用戶角色）
        const initChats: Record<string, Message[]> = {}
        selectedCharacters.forEach((char) => {
            if (char.CharacterType.id !== userCharacter?.CharacterType.id) {
                const systemPrompt = generateSystemPrompt(char, selectedCharacters)
                initChats[char.CharacterType.id!] = [{ role: "system", content: systemPrompt }]
            } else {
                initChats[char.CharacterType.id!] = []
            }
        })
        setChatMap(initChats)
        setStep(3)
        setActiveIndex(0)
        setIsPlaying(true)
    }

    const startNextMessage = async () => {
        if (isGenerating || isWaitingForUser) return

        const currentChar = selectedCharacters[activeIndex]
        if (!currentChar) return // 防護檢查

        setCurrentSpeaker(currentChar.CharacterType.id!)

        // 如果當前角色是用戶角色，等待用戶輸入
        if (currentChar.CharacterType.id === userCharacter?.CharacterType.id) {
            setIsWaitingForUser(true)
            return
        }

        // 否則是AI角色，調用API
        setIsGenerating(true)

        try {
            const isFirstMessage = allMessages.length === 0

            if (isFirstMessage || isThinkingRespond === false) {
                // 對話起始角色，或不需要思考是否回應，直接發言
                await generateMessage(currentChar)
            } else {
                // 其他角色依照 shouldRespond 判斷是否要說話
                const wantsToRespond = await thinkingRespond(currentChar)
                if (wantsToRespond) {
                    await generateMessage(currentChar)
                }
            }

            // 確保在完成後才切換到下一個角色
            setTimeout(() => {
                setActiveIndex((prev) => (prev + 1) % selectedCharacters.length)
            }, 100)
        } catch (error) {
            console.error("生成消息失敗:", error)
            setActiveIndex((prev) => (prev + 1) % selectedCharacters.length)
        } finally {
            setIsGenerating(false)
            setCurrentSpeaker("")
        }
    }

    const generateMessage = async (character: CharacterChatType) => {
        // 產生角色專屬的 system prompt
        const systemPrompt = generateSystemPrompt(character, selectedCharacters)

        const messages: Message[] = [
            {
                role: "system",
                content: systemPrompt,
            },
        ]

        let buffer = "" // 用來累積非主角訊息

        allMessages.forEach((msg, index) => {
            const isCurrentCharacter = msg.characterId === character.CharacterType.id

            if (!isCurrentCharacter) {
                // 將非主角訊息加入 buffer
                buffer += `以下是 ${msg.character.CharacterType.name} 的回應： ${msg.content}\r\n`
            }

            const isLastMessage = index === allMessages.length - 1

            if (isCurrentCharacter) {
                // 在塞入 assistant 前，把 buffer（如果有）先塞進去
                if (buffer.trim()) {
                    messages.push({
                        role: "user",
                        content: buffer,
                    })
                    buffer = ""
                }

                messages.push({
                    role: "assistant",
                    content: msg.content,
                })
            } else if (isLastMessage) {
                // 如果最後一條是非主角訊息，結尾也要塞進去
                if (buffer.trim()) {
                    messages.push({
                        role: "user",
                        content:
                            buffer +
                            `\r\n請以符合自己身分(${character.CharacterType.name})的方式，用自然語言回應這些對話，不一定要逐條回覆，可以回覆你想回覆的對話即可。`,
                    })
                }
            }
        })

        if (isDevelopment) console.log(`${character.CharacterType.name} fetch llm api payload messages:`, messages)

        abortControllerRef.current = new AbortController()

        try {
            const response = await fetch("/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages,
                    settings,
                    stream: true,
                }),
                signal: abortControllerRef.current.signal,
            })

            if (!response.ok) throw new Error("API request failed")

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let content = ""

            // 在 chatMap 中添加一個空的訊息佔位
            setChatMap((prev) => ({
                ...prev,
                [character.CharacterType.id!]: [...prev[character.CharacterType.id!], { role: "assistant", content: "" }],
            }))

            let firstTokenReceived = false // 追蹤是否已收到第一個token
            const tempMessageId = Date.now().toString()

            // 先添加等待動畫消息
            setAllMessages((prev) => [
                ...prev,
                {
                    id: tempMessageId,
                    characterId: character.CharacterType.id!,
                    character,
                    content: "",
                    reason: "",
                    timestamp: new Date(),
                    isUser: false,
                    isWaiting: true, // 標記為等待狀態
                },
            ])

            setIsAutoScrolling(true);

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    const chunk = decoder.decode(value, { stream: true })
                    const lines = chunk.split("\n")

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6)
                            if (data === "[DONE]") break

                            try {
                                const parsed = JSON.parse(data)
                                const delta = parsed.choices?.[0]?.delta?.content
                                if (delta) {
                                    content += delta

                                    // 即時更新 chatMap
                                    setChatMap((prev) => {
                                        const msgs = [...prev[character.CharacterType.id!]]
                                        const lastIndex = msgs.length - 1
                                        if (lastIndex >= 0 && msgs[lastIndex].role === "assistant") {
                                            msgs[lastIndex] = { ...msgs[lastIndex], content }
                                        }
                                        return {
                                            ...prev,
                                            [character.CharacterType.id!]: msgs,
                                        }
                                    })

                                    const _pc: ParsedContent = parseContent(content)
                                    // 收到第一個token時，切換到正常顯示
                                    if (!firstTokenReceived && content.trim().length > 0) {
                                        firstTokenReceived = true
                                        setAllMessages((prev) =>
                                            prev.map((msg) =>
                                                msg.id === tempMessageId
                                                    ? { ...msg, content: _pc.content, reason: _pc.reason, isWaiting: false }
                                                    : msg,
                                            ),
                                        )
                                    } else {
                                        // 後續更新內容
                                        setAllMessages((prev) =>
                                            prev.map((msg) =>
                                                msg.id === tempMessageId ? { ...msg, content: _pc.content, reason: _pc.reason } : msg,
                                            ),
                                        )
                                    }
                                }
                            } catch (_) {
                                // 忽略解析錯誤
                            }
                        }
                    }
                }
            }

            // 最後補上清理空白與統一資料
            const finalContent = content.trim()
            setChatMap((prev) => {
                const msgs = [...prev[character.CharacterType.id!]]
                const lastIndex = msgs.length - 1
                if (lastIndex >= 0 && msgs[lastIndex].role === "assistant") {
                    msgs[lastIndex] = { ...msgs[lastIndex], content: finalContent }
                }
                return {
                    ...prev,
                    [character.CharacterType.id!]: msgs,
                }
            })

            const _pc: ParsedContent = parseContent(finalContent)
            // 確保最終消息狀態正確
            setAllMessages((prev) =>
                prev.map((msg) =>
                    msg.id === tempMessageId ? { ...msg, content: _pc.content, reason: _pc.reason, isWaiting: false } : msg,
                ),
            )
        } catch (error) {
            if ((error as any).name === "AbortError") {
                if (isDevelopment) console.log("請求被取消")
            } else {
                throw error
            }
        }
    }

    // 決定是否回應該對話
    const thinkingRespond = async (character: CharacterChatType): Promise<boolean> => {
        // 產生角色專屬的 system prompt
        const systemPrompt = shouldRespondSystemPrompt(character, selectedCharacters)

        const messages: Message[] = [
            {
                role: "system",
                content: systemPrompt,
            },
        ]

        let buffer = "" // 用來累積非主角訊息

        allMessages.forEach((msg, index) => {
            const isCurrentCharacter = msg.characterId === character.CharacterType.id

            if (!isCurrentCharacter) {
                // 將非主角訊息加入 buffer
                buffer += `以下是 ${msg.character.CharacterType.name} 的回應： ${msg.content}\r\n`
            }

            const isLastMessage = index === allMessages.length - 1

            if (isCurrentCharacter) {
                // 在塞入 assistant 前，把 buffer（如果有）先塞進去
                if (buffer.trim()) {
                    messages.push({
                        role: "user",
                        content: buffer,
                    })
                    buffer = ""
                }

                messages.push({
                    role: "assistant",
                    content: msg.content,
                })
            } else if (isLastMessage) {
                // 如果最後一條是非主角訊息，結尾也要塞進去
                if (buffer.trim()) {
                    messages.push({
                        role: "user",
                        content:
                            buffer +
                            `\r\n請以符合自己身分(${character.CharacterType.name})的方式，依照system prompt的指示，回傳正確的JSON格式。`,
                    })
                }
            }
        })

        if (isDevelopment)
            console.log(`${character.CharacterType.name} fetch llm api 判斷是否回應 payload messages:`, messages)

        abortControllerRef.current = new AbortController()

        try {
            const response = await fetch("/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages,
                    settings,
                    stream: false,
                }),
                signal: abortControllerRef.current.signal,
            })

            const result = await response.json()

            // 抓出 content 字串
            const raw = result.choices?.[0]?.message?.content

            if (isDevelopment) console.log(`${character.CharacterType.name} 決定是否回應 (原始content):`, raw)

            const _pc = parseContent(raw)

            const parsed = safeParseJson<{ respond: boolean }>(_pc.content)
            if (parsed && typeof parsed.respond === "boolean") {
                return parsed.respond
            } else {
                console.warn("解析失敗或 respond 欄位不存在，預設回應 true")
                return true // 預設回應
            }
        } catch (error) {
            if ((error as any).name === "AbortError") {
                if (isDevelopment) console.log("請求被取消")
                return false
            } else {
                console.warn("JSON 解析失敗：", error)
                return true // 預設回應，避免對話中斷
            }
        }
    }

    const pauseConversation = () => {
        setIsPlaying(false)
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
    }

    const resumeConversation = () => {
        setIsPlaying(true)
        if (!isGenerating && !isWaitingForUser) {
            startNextMessage()
        }
    }

    const restartConversation = () => {
        // 停止當前對話
        setIsPlaying(false)
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        setIsGenerating(false)
        setIsWaitingForUser(false)
        setCurrentSpeaker("")

        // 重置狀態
        setStep(1)
        setSelected({})
        setSelectedOrder([])
        setSelectedCharacters([])
        setUserCharacter(null)
        setChatMap({})
        setActiveIndex(0)
        setAllMessages([])
        setUserInput("")
        setMotionSettings({}) // 重置動作設定
    }

    const fetchData = async () => {
        try {
            setIsLoadingDB(true);
            const rawCharacters = await ActionGetCharactersByUser({ userId: session.user.id });

            // 型別轉換
            const characters: CharacterType[] = rawCharacters.map((char) => ({
                id: char.id,
                userId: char.userId,
                image: char.image,
                name: char.name,
                tag: char.tag ?? "",
                gender: char.gender as Gender,
                birthday: char.birthday,
                zodiac: char.zodiac,
                bloodType: char.bloodType as BloodType,
                mbti: char.mbti as PersonalityType,
                systemPrompt: char.systemPrompt ?? "",
            }));

            setCharacters(characters);
        } catch (error) {
            console.error("載入角色失敗：", error);
            toast.error("載入角色失敗，請稍後再試");
            setCharacters([]);
        } finally {
            setIsLoadingDB(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        // 當進入聊天室且 chatMap 已初始化時，開始第一條消息
        if (step === 3 && Object.keys(chatMap).length > 0 && isPlaying && !isGenerating && !isWaitingForUser) {
            const hasAnyMessages = allMessages.length > 0

            // 如果還沒有任何消息，開始第一條消息
            if (!hasAnyMessages) {
                startNextMessage()
            }
        }
    }, [step, chatMap, isPlaying, isGenerating, isWaitingForUser, allMessages.length])

    useEffect(() => {
        if (isPlaying && !isGenerating && !isWaitingForUser && step === 3 && Object.keys(chatMap).length > 0) {
            // 檢查是否已經有消息了
            const hasMessages = allMessages.length > 0

            if (hasMessages) {
                const timer = setTimeout(() => {
                    startNextMessage()
                }, 1500) // 增加間隔時間
                return () => clearTimeout(timer)
            }
        }
    }, [isPlaying, isGenerating, isWaitingForUser, activeIndex, step, chatMap, allMessages.length])

    return (
        <div className="space-y-6">
            {/* Header */}
            {step < 3 && (
                <>
                    <div className="text-center space-y-2">
                        <div className="flex items-center justify-center gap-2">
                            <MessagesSquare className="w-8 h-8 text-purple-600" />
                            <h1 className="text-3xl font-bold">AI 聊天室</h1>
                        </div>
                        <p className="text-zinc-500">讓你的 AI 角色們進行精彩對話</p>
                    </div>

                    {/* Progress Steps */}
                    <div className="flex items-center justify-center space-x-4 mb-8">
                        {[1, 2, 3].map((num) => (
                            <div key={num} className="flex items-center">
                                <div
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center font-semibold",
                                        step >= num ? "bg-purple-600 text-white" : "bg-zinc-200 text-zinc-500",
                                    )}
                                >
                                    {num}
                                </div>
                                {num < 3 && <ArrowRight className="w-4 h-4 mx-2 text-zinc-400" />}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Step 1: 選擇角色 */}
            {step === 1 && (
                <Step1
                    includeUser={includeUser}
                    setIncludeUser={setIncludeUser}
                    useExistingCharacter={useExistingCharacter}
                    setUseExistingCharacter={setUseExistingCharacter}
                    selectedUserCharacter={selectedUserCharacter}
                    setSelectedUserCharacter={setSelectedUserCharacter}
                    characters={characters}
                    tempCharacter={tempCharacter}
                    setTempCharacter={setTempCharacter}
                    isThinkingRespond={isThinkingRespond}
                    setIsThinkingRespond={setIsThinkingRespond}
                    selectedOrder={selectedOrder}
                    isLoadingDB={isLoadingDB}
                    selected={selected}
                    setSelected={setSelected}
                    setSelectedOrder={setSelectedOrder}
                    motionSettings={motionSettings}
                    setMotionSettings={setMotionSettings}
                    setSelectedCharacters={setSelectedCharacters}
                    setUserCharacter={setUserCharacter}
                    setChatMap={setChatMap}
                    setStep={setStep}
                />
            )}

            {/* Step 2: 場景設定 */}
            {step === 2 && (
                <Step2
                    promptSettings={promptSettings}
                    setPromptSettings={setPromptSettings}
                    setStep={setStep}
                    startConversation={startConversation}
                />
            )}

            {/* Step 3: 聊天室 */}
            {step === 3 && (
                <Step3
                    isPlaying={isPlaying}
                    isGenerating={isGenerating}
                    isWaitingForUser={isWaitingForUser}
                    pauseConversation={pauseConversation}
                    resumeConversation={resumeConversation}
                    restartConversation={restartConversation}
                    currentSpeaker={currentSpeaker}
                    selectedCharacters={selectedCharacters}
                    allMessages={allMessages}
                    userCharacter={userCharacter}
                    userInput={userInput}
                    setUserInput={setUserInput}
                    promptSettings={promptSettings}
                    setChatMap={setChatMap}
                    setAllMessages={setAllMessages}
                    setIsWaitingForUser={setIsWaitingForUser}
                    setCurrentSpeaker={setCurrentSpeaker}
                    setActiveIndex={setActiveIndex}
                    isAutoScrolling={isAutoScrolling}
                    setIsAutoScrolling={setIsAutoScrolling}
                />
            )}
        </div>
    )
}
