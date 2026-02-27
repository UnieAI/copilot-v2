"use client"

import React, { useEffect } from "react"

import type { Message } from "@/utils/llm/type"
import type { CharacterType } from "@/utils/character/type"
import type { CharacterChatType } from "@/utils/chat-room/type"
import {
    Gender,
    type BloodType,
    type PersonalityType,
    GENDER_OPTIONS,
    BLOOD_TYPE_OPTIONS,
    PERSONALITY_OPTIONS,
} from "@/utils/character"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, ArrowRight, Star, Mars, Venus, Brain } from "lucide-react"
import Image from "next/image"
import { cn } from "../../../lib/utils"
import { toast } from "sonner"

import { handleOnBirthdayChange } from "@/utils/character/functions"
import LoadingSpinner from "@/components/shared/loading-spinner"

interface Props {
    includeUser: boolean
    setIncludeUser: React.Dispatch<React.SetStateAction<boolean>>
    useExistingCharacter: boolean
    setUseExistingCharacter: React.Dispatch<React.SetStateAction<boolean>>
    selectedUserCharacter: string
    setSelectedUserCharacter: React.Dispatch<React.SetStateAction<string>>
    characters: CharacterType[]
    tempCharacter: CharacterType
    setTempCharacter: React.Dispatch<React.SetStateAction<CharacterType>>
    isThinkingRespond: boolean
    setIsThinkingRespond: React.Dispatch<React.SetStateAction<boolean>>
    selectedOrder: string[]
    isLoadingDB: boolean
    selected: Record<string, boolean>
    setSelected: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    setSelectedOrder: React.Dispatch<React.SetStateAction<string[]>>
    motionSettings: Record<string, boolean>
    setMotionSettings: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    setSelectedCharacters: React.Dispatch<React.SetStateAction<CharacterChatType[]>>
    setUserCharacter: React.Dispatch<React.SetStateAction<CharacterChatType | null>>
    setChatMap: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>
    setStep: React.Dispatch<React.SetStateAction<number>>
}

export const Step1 = ({
    includeUser,
    setIncludeUser,
    useExistingCharacter,
    setUseExistingCharacter,
    selectedUserCharacter,
    setSelectedUserCharacter,
    characters,
    tempCharacter,
    setTempCharacter,
    isThinkingRespond,
    setIsThinkingRespond,
    selectedOrder,
    isLoadingDB,
    selected,
    setSelected,
    setSelectedOrder,
    motionSettings,
    setMotionSettings,
    setSelectedCharacters,
    setUserCharacter,
    setChatMap,
    setStep,
}: Props) => {

    // 檢查角色是否被用戶選為參與角色
    const isCharacterUsedByUser = (characterId: string) => {
        return includeUser && useExistingCharacter && selectedUserCharacter === characterId
    }

    // 檢查並處理用戶角色與AI角色重複的情況
    useEffect(() => {
        if (includeUser && useExistingCharacter && selectedUserCharacter) {
            // 如果用戶選擇的角色已經在AI角色列表中，移除它
            if (selected[selectedUserCharacter]) {
                const characterName = characters.find((c) => c.id === selectedUserCharacter)?.name || "未知角色"

                // 從選中狀態移除
                setSelected((prev) => ({
                    ...prev,
                    [selectedUserCharacter]: false,
                }))

                // 從選擇順序移除
                setSelectedOrder((prevOrder) => prevOrder.filter((id) => id !== selectedUserCharacter))

                // 從動作設定移除
                setMotionSettings((prev) => {
                    const newSettings = { ...prev }
                    delete newSettings[selectedUserCharacter]
                    return newSettings
                })

                // 顯示警告 toast
                toast.warning(`AI 角色 ${characterName} 重複，已從清單移除`)
            }
        }
    }, [
        includeUser,
        useExistingCharacter,
        selectedUserCharacter,
        selected,
        characters,
        setSelected,
        setSelectedOrder,
        setMotionSettings,
    ]);

    const toggleSelect = (id: string) => {
        // 如果這個角色被用戶選為參與角色，則不允許選擇
        if (isCharacterUsedByUser(id)) {
            const characterName = characters.find((c) => c.id === id)?.name || "未知角色"
            toast.warning(`${characterName} 已被選為用戶參與角色，無法同時作為AI角色`);
            return
        }

        const isSelecting = !selected[id]

        setSelected((prev) => ({
            ...prev,
            [id]: isSelecting,
        }))

        setSelectedOrder((prevOrder) => (isSelecting ? [...prevOrder, id] : prevOrder.filter((orderId) => orderId !== id)))
    }

    const startStepTwo = () => {
        // 按照選擇順序排列角色，並包裝成 CharacterChatType
        const chosen = selectedOrder
            .map((id) => characters.find((c) => c.id === id))
            .filter(Boolean)
            .map((char) => wrapCharacterType(char as CharacterType)) as CharacterChatType[]

        const finalCharacters = [...chosen]

        let finalUserCharacter: CharacterChatType | null = null

        if (includeUser) {
            if (useExistingCharacter && selectedUserCharacter) {
                const existingChar = characters.find((c) => c.id === selectedUserCharacter)
                if (existingChar) {
                    finalUserCharacter = wrapCharacterType(existingChar, false)
                }
            } else if (!useExistingCharacter) {
                // 驗證臨時角色資料
                if (!tempCharacter.name.trim()) {
                    toast.warning("請填寫角色名稱！")
                    return
                }
                if (!tempCharacter.birthday.trim()) {
                    toast.warning("請填寫角色生日！")
                    return
                }
                if (!tempCharacter.systemPrompt.trim()) {
                    toast.warning("請填寫角色描述！")
                    return
                }
                finalUserCharacter = wrapCharacterType(tempCharacter, true)
            } else {
                toast.warning("請選擇現有角色或填寫臨時角色資訊！")
                return
            }
        }

        if (finalCharacters.length >= 1 && (includeUser ? finalUserCharacter : finalCharacters.length >= 2)) {
            // 如果有用戶參與，用戶角色放在最前面
            if (finalUserCharacter) {
                setSelectedCharacters([finalUserCharacter, ...finalCharacters])
                setUserCharacter(finalUserCharacter)
            } else {
                setSelectedCharacters(finalCharacters)
                setUserCharacter(null)
            }

            const initChats: Record<string, Message[]> = {}
            const allChars = finalUserCharacter ? [finalUserCharacter, ...finalCharacters] : finalCharacters
            allChars.forEach((c) => (initChats[c.CharacterType.id!] = []))
            setChatMap(initChats)
            setStep(2)
        } else {
            alert(includeUser ? "請選擇至少一位AI角色！" : "請選擇至少兩位角色！")
        }
    }

    // 將 CharacterType 包裝成 CharacterChatType
    const wrapCharacterType = (char: CharacterType, isTemp = false): CharacterChatType => {
        return {
            CharacterType: char,
            temp_user: isTemp,
            use_motion: motionSettings[char.id!] || false, // 使用用戶設定的動作選項
        }
    }

    useEffect(() => {
        setSelectedUserCharacter("");
    }, [includeUser, useExistingCharacter]);

    return (
        <Card className="bg-zinc-50 dark:bg-zinc-950 shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    選擇參與對話的角色
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* 用戶參與選項 */}
                <div className="border rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-4">
                        <Checkbox
                            id="include-user"
                            checked={includeUser}
                            onCheckedChange={(checked) => setIncludeUser(checked as boolean)}
                        />
                        <Label htmlFor="include-user" className="font-medium">
                            我也要參與對話
                        </Label>
                    </div>
                    {includeUser && (
                        <div className="space-y-4 ml-6">
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="use-existing"
                                        checked={useExistingCharacter}
                                        onCheckedChange={(checked) => setUseExistingCharacter(checked as boolean)}
                                    />
                                    <Label htmlFor="use-existing">使用現有角色</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="create-new"
                                        checked={!useExistingCharacter}
                                        onCheckedChange={(checked) => setUseExistingCharacter(!checked)}
                                    />
                                    <Label htmlFor="create-new">創建臨時角色</Label>
                                </div>
                            </div>

                            {useExistingCharacter ? (
                                <Select value={selectedUserCharacter} onValueChange={setSelectedUserCharacter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="選擇一個角色..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {characters.map((char) => (
                                            <SelectItem key={char.id} value={char.id!}>
                                                {char.name} ({char.personality})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="space-y-4 border rounded-lg p-4 bg-zinc-100 dark:bg-zinc-900">
                                    <h4 className="font-medium text-zinc-500">臨時角色資訊</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>角色名稱</Label>
                                            <Input
                                                placeholder="輸入角色名稱"
                                                value={tempCharacter.name}
                                                onChange={(e) => setTempCharacter((prev) => ({ ...prev, name: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>性別</Label>
                                            <div className="flex gap-2">
                                                {GENDER_OPTIONS.map((option) => (
                                                    <Button
                                                        key={option.value}
                                                        type="button"
                                                        variant={tempCharacter.gender === option.value ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => setTempCharacter((prev) => ({ ...prev, gender: option.value }))}
                                                        className="flex-1"
                                                    >
                                                        {option.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>生日</Label>
                                            <Input
                                                type="date"
                                                value={tempCharacter.birthday}
                                                onChange={(e) => handleOnBirthdayChange(e.target.value, setTempCharacter)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>星座 (自動計算)</Label>
                                            <div className="flex items-center gap-2 p-2 border rounded-md">
                                                <Star className="w-4 h-4 text-yellow-500" />
                                                <span className="text-sm">{tempCharacter.zodiac || "請先選擇生日"}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>血型</Label>
                                            <Select
                                                value={tempCharacter.bloodType}
                                                onValueChange={(value) =>
                                                    setTempCharacter((prev) => ({ ...prev, bloodType: value as BloodType }))
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {BLOOD_TYPE_OPTIONS.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>人格類型</Label>
                                            <Select
                                                value={tempCharacter.personality}
                                                onValueChange={(value) =>
                                                    setTempCharacter((prev) => ({ ...prev, personality: value as PersonalityType }))
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PERSONALITY_OPTIONS.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>角色描述</Label>
                                        <Textarea
                                            placeholder="描述角色的性格、背景、說話風格等..."
                                            value={tempCharacter.systemPrompt}
                                            onChange={(e) => setTempCharacter((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                                            className="min-h-[80px]"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 角色選擇網格 */}
                <div className="space-y-4">
                    <div className="border rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-4">
                            <Checkbox
                                id="thinking-respond"
                                checked={isThinkingRespond}
                                onCheckedChange={(checked) => setIsThinkingRespond(checked as boolean)}
                            />
                            <Label htmlFor="thinking-respond" className="font-medium">
                                啟用 AI 思考是否回應
                            </Label>
                        </div>
                    </div>

                    <div className="text-sm text-zinc-600">
                        {(selectedOrder.length > 0 || includeUser) && (
                            <p>
                                發話順序：
                                {(() => {
                                    const orderDisplay = []
                                    let index = 1

                                    // 如果用戶參與對話，用戶排第一
                                    if (includeUser) {
                                        const userName =
                                            useExistingCharacter && selectedUserCharacter
                                                ? characters.find((c) => c.id === selectedUserCharacter)?.name
                                                : tempCharacter.name || "使用者"
                                        orderDisplay.push(`${index}. ${userName}(使用者)`)
                                        index++
                                    }

                                    // 添加選中的AI角色
                                    selectedOrder.forEach((id) => {
                                        const char = characters.find((c) => c.id === id)
                                        if (char) {
                                            orderDisplay.push(`${index}. ${char.name}`)
                                            index++
                                        }
                                    })

                                    return orderDisplay.join(" → ")
                                })()}
                            </p>
                        )}
                    </div>
                    {isLoadingDB ? (
                        <div className="flex w-full flex-row justify-center items-center gap-4">
                            <LoadingSpinner variant="circle-dots" size="sm" />
                            <span className="opacity-50">Loading...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {characters.map((char) => {
                                const isUsedByUser = isCharacterUsedByUser(char.id!)
                                const isDisabled = isUsedByUser

                                return (
                                    <Card
                                        key={char.id}
                                        className={cn(
                                            "cursor-pointer transition-all hover:shadow-md",
                                            selected[char.id!] ? "ring-2 ring-blue-700" : "hover:bg-opacity-50",
                                            isDisabled && "opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800",
                                        )}
                                        onClick={() => !isDisabled && toggleSelect(char.id!)}
                                    >
                                        <CardContent className="p-4">
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-12 h-12 rounded-full overflow-hidden">
                                                        <Image
                                                            src={char.image || "/placeholder.svg"}
                                                            alt={char.name}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex flex-row gap-2 items-center">
                                                            <h3 className="font-semibold">{char.name}</h3>
                                                            {char.gender === Gender.MALE ? (
                                                                <Mars className="w-3 h-3 text-blue-500 mr-1" />
                                                            ) : (
                                                                <Venus className="w-3 h-3 text-pink-500 mr-1" />
                                                            )}
                                                            <p className="text-xs text-zinc-500">{char.tag}</p>
                                                        </div>
                                                        <div className="flex flex-row gap-2 items-center">
                                                            <Badge variant="outline" className="text-xs mt-1 gap-2">
                                                                <Brain className="w-3 h-3 text-purple-500" />
                                                                <p className="text-sm text-zinc-500">{char.personality}</p>
                                                            </Badge>
                                                            <Badge variant="outline" className="text-xs mt-1">
                                                                <p className="text-sm text-zinc-500">
                                                                    {char.zodiac} • {char.bloodType}型
                                                                </p>
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-1">
                                                        {selected[char.id!] && (
                                                            <Badge variant="secondary" className="text-xs">
                                                                #{selectedOrder.indexOf(char.id!) + 1}
                                                            </Badge>
                                                        )}
                                                        {isUsedByUser && (
                                                            <Badge variant="destructive" className="text-xs">
                                                                用戶角色
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 動作描述選項 */}
                                                {selected[char.id!] && !isDisabled && (
                                                    <div className="flex items-center space-x-2 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md">
                                                        <Checkbox
                                                            id={`motion-${char.id}`}
                                                            checked={motionSettings[char.id!] || false}
                                                            onCheckedChange={(checked) => {
                                                                setMotionSettings((prev) => ({
                                                                    ...prev,
                                                                    [char.id!]: checked as boolean,
                                                                }))
                                                            }}
                                                            onClick={(e) => e.stopPropagation()} // 防止觸發卡片點擊
                                                        />
                                                        <Label
                                                            htmlFor={`motion-${char.id}`}
                                                            className="w-full text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer"
                                                            onClick={(e) => e.stopPropagation()} // 防止觸發卡片點擊
                                                        >
                                                            允許動作描述
                                                        </Label>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="flex justify-end">
                    <Button
                        variant="outline"
                        onClick={startStepTwo}
                        className="hover:bg-blue-500 hover:border-blue-700 bg-transparent"
                    >
                        下一步
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
