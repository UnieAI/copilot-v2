"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { initialCharacter, type CharacterType } from "@/utils/character/type"
import {
  Gender,
  BloodType,
  PersonalityType,
  GENDER_OPTIONS,
  BLOOD_TYPE_OPTIONS,
  PERSONALITY_OPTIONS,
} from "@/utils/character"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, Users, Star, Mars, Venus, ArrowLeft, ArrowRight } from "lucide-react"
import Image from "next/image"
import { cn } from "../../../lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { handleOnBirthdayChange } from "@/utils/character/functions"
import { handleDrag, handleDrop, handleImageUpload } from "@/utils/character/character-image/functions"
import { Session } from "next-auth"
import { ActionCreateCharacter } from "@/app/(main)/actions"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"

interface Props {
  session: Session
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  fetchData: () => Promise<void>
}

export const CreateCharacterDialog = ({ session, open, setOpen, fetchData }: Props) => {
  const [step, setStep] = useState<1 | 2>(1)

  const [newCharacter, setNewCharacter] = useState<CharacterType>(initialCharacter)

  const [dragActive, setDragActive] = useState<boolean>(false)

  const [validationAlert, setValidationAlert] = useState<{
    open: boolean
    missingFields: string[]
  }>({
    open: false,
    missingFields: [],
  })

  const isFemale = newCharacter.gender === Gender.FEMALE

  // 第一頁必填驗證
  const validateRequiredFields = () => {
    const requiredFields = [
      { field: "image", label: "角色頭像", value: newCharacter.image },
      { field: "name", label: "姓名", value: newCharacter.name },
      { field: "gender", label: "性別", value: newCharacter.gender },
      { field: "birthday", label: "生日", value: newCharacter.birthday },
      { field: "bloodType", label: "血型", value: newCharacter.bloodType },
      { field: "mbti", label: "MBTI", value: newCharacter.mbti },
    ]

    const missing = requiredFields
      .filter(({ value }) => !value || (typeof value === "string" && value.trim() === ""))
      .map(({ label }) => label)

    if (missing.length > 0) {
      setValidationAlert({ open: true, missingFields: missing })
      return false
    }
    return true
  }

  const handleNext = () => {
    if (validateRequiredFields()) {
      setStep(2)
    }
  }

  const handlePrev = () => {
    setStep(1)
  }

  const createCharacter = async () => {
    try {
      if (!session?.user.id) {
        throw new Error("無法取得使用者 ID")
      }

      const { id, userId, ...createData } = newCharacter

      await ActionCreateCharacter({
        userId: session.user.id,
        ...createData,
      })

      toast.success("角色建立成功")
      setOpen(false)
      setStep(1)
      setNewCharacter(initialCharacter)
      await fetchData()
    } catch (error) {
      console.error("建立角色失敗：", error)
      toast.error("建立角色失敗，請稍後再試")
    }
  }

  // 當 dialog 開啟時重置表單
  useEffect(() => {
    if (open) {
      setNewCharacter(initialCharacter);
      setStep(1);           // 同時重置到第一頁
      setDragActive(false); // 如果需要
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-blue-600 hover:bg-blue-700 shadow-lg">
          <Users className="w-4 h-4 mr-2" />
          新增角色
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {step === 1 ? "新增角色 - 基本資訊" : "新增角色 - 進階資訊（選填）"}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          // ── 第一頁：必填 ──
          <div className="grid gap-6 py-4">
            {/* 頭像上傳 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">角色頭像（必填）</Label>
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                  dragActive ? "border-blue-500 bg-blue-50" : "border-zinc-300 hover:border-zinc-400"
                )}
                onDragEnter={(e) => handleDrag(e, setDragActive)}
                onDragLeave={(e) => handleDrag(e, setDragActive)}
                onDragOver={(e) => handleDrag(e, setDragActive)}
                onDrop={(e) => handleDrop(e, setDragActive, setNewCharacter)}
              >
                {newCharacter.image ? (
                  <div className="space-y-4">
                    <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-white shadow-lg">
                      <Image src={newCharacter.image} alt="Preview" fill className="object-cover" />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNewCharacter((prev) => ({ ...prev, image: "" }))}
                    >
                      重新選擇
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-zinc-100 rounded-full flex items-center justify-center">
                      <Upload className="w-8 h-8 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-zinc-700">拖拽圖片到此處</p>
                      <p className="text-sm text-zinc-500">或點擊選擇檔案</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, setNewCharacter)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 姓名 + 註記 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">姓名（必填）</Label>
                <Input
                  id="name"
                  placeholder="輸入角色姓名"
                  value={newCharacter.name}
                  onChange={(e) => setNewCharacter({ ...newCharacter, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag">註記</Label>
                <Input
                  id="tag"
                  placeholder="輸入角色註記（選填）"
                  value={newCharacter.tag}
                  onChange={(e) => setNewCharacter({ ...newCharacter, tag: e.target.value })}
                />
              </div>
            </div>

            {/* 性別 + 生日 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>性別（必填）</Label>
                <div className="flex gap-2">
                  {GENDER_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={newCharacter.gender === option.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewCharacter({ ...newCharacter, gender: option.value })}
                      className="flex-1"
                    >
                      {option.value === Gender.MALE ? (
                        <Mars className="w-3 h-3 text-blue-500 mr-1" />
                      ) : (
                        <Venus className="w-3 h-3 text-pink-500 mr-1" />
                      )}
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>生日與星座（必填）</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={newCharacter.birthday}
                    onChange={(e) => handleOnBirthdayChange(e.target.value, setNewCharacter)}
                    className="w-1/2"
                  />
                  <div className="w-1/2 flex items-center justify-center gap-2 p-2 border rounded-md">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm">{newCharacter.zodiac || "請先選擇生日"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 血型 + MBTI */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>血型（必填）</Label>
                <Select
                  value={newCharacter.bloodType}
                  onValueChange={(value) => setNewCharacter({ ...newCharacter, bloodType: value as BloodType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇血型" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>MBTI（必填）</Label>
                <Select
                  value={newCharacter.mbti}
                  onValueChange={(value) => setNewCharacter({ ...newCharacter, mbti: value as PersonalityType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇MBTI" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSONALITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* System Prompt */}
            <div className="space-y-2">
              <Label>System Prompt（必填）</Label>
              <Textarea
                placeholder="描述角色的行為模式、說話風格、背景設定等..."
                value={newCharacter.systemPrompt}
                onChange={(e) => setNewCharacter({ ...newCharacter, systemPrompt: e.target.value })}
                className="min-h-[100px]"
              />
            </div>
          </div>
        ) : (
          // ── 第二頁：選填 ──
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label className="text-lg font-medium">進階資訊（可選填）</Label>
              <p className="text-sm text-muted-foreground">
                這些欄位可幫助角色更豐富，之後仍可編輯。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>英文名 / 別名</Label>
                <Input
                  placeholder="英文名或別稱（選填）"
                  value={newCharacter.englishName ?? ""}
                  onChange={(e) => setNewCharacter({ ...newCharacter, englishName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>出生地</Label>
                <Input
                  placeholder="出生地（選填）"
                  value={newCharacter.birthplace ?? ""}
                  onChange={(e) => setNewCharacter({ ...newCharacter, birthplace: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>外貌描述</Label>
              <Textarea
                placeholder="角色的外貌特徵、穿著風格等（選填）"
                value={newCharacter.appearance ?? ""}
                onChange={(e) => setNewCharacter({ ...newCharacter, appearance: e.target.value })}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label>詳細背景 / 故事</Label>
              <Textarea
                placeholder="角色的背景故事、經歷、特殊設定等（選填）"
                value={newCharacter.detail ?? ""}
                onChange={(e) => setNewCharacter({ ...newCharacter, detail: e.target.value })}
                className="min-h-[100px]"
              />
            </div>

            {isFemale && (
              <>
                <div className="space-y-2">
                  <Label>教育背景 / 學歷</Label>
                  <Input
                    placeholder="就讀學校、學歷等（選填）"
                    value={newCharacter.education ?? ""}
                    onChange={(e) => setNewCharacter({ ...newCharacter, education: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>制服細節（JSON）</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="uniform-tie"
                      checked={newCharacter.uniformDetail?.tie ?? false}
                      onCheckedChange={(checked) =>
                        setNewCharacter((prev) => ({
                          ...prev,
                          uniformDetail: {
                            ...(prev.uniformDetail || {
                              tie: false,
                              schoolName: false,
                              name: false,
                              studentNumber: false,
                            }),
                            tie: !!checked,
                          },
                        }))
                      }
                    />
                    <Label htmlFor="uniform-tie" className="text-sm font-medium cursor-pointer">
                      領結 (Tie)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="uniform-schoolName"
                      checked={newCharacter.uniformDetail?.schoolName ?? false}
                      onCheckedChange={(checked) =>
                        setNewCharacter((prev) => ({
                          ...prev,
                          uniformDetail: {
                            ...(prev.uniformDetail || {
                              tie: false,
                              schoolName: false,
                              name: false,
                              studentNumber: false,
                            }),
                            schoolName: !!checked,
                          },
                        }))
                      }
                    />
                    <Label htmlFor="uniform-schoolName" className="text-sm font-medium cursor-pointer">
                      校名 (School Name)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="uniform-name"
                      checked={newCharacter.uniformDetail?.name ?? false}
                      onCheckedChange={(checked) =>
                        setNewCharacter((prev) => ({
                          ...prev,
                          uniformDetail: {
                            ...(prev.uniformDetail || {
                              tie: false,
                              schoolName: false,
                              name: false,
                              studentNumber: false,
                            }),
                            name: !!checked,
                          },
                        }))
                      }
                    />
                    <Label htmlFor="uniform-name" className="text-sm font-medium cursor-pointer">
                      姓名 (Name)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="uniform-studentNumber"
                      checked={newCharacter.uniformDetail?.studentNumber ?? false}
                      onCheckedChange={(checked) =>
                        setNewCharacter((prev) => ({
                          ...prev,
                          uniformDetail: {
                            ...(prev.uniformDetail || {
                              tie: false,
                              schoolName: false,
                              name: false,
                              studentNumber: false,
                            }),
                            studentNumber: !!checked,
                          },
                        }))
                      }
                    />
                    <Label htmlFor="uniform-studentNumber" className="text-sm font-medium cursor-pointer">
                      學號 (Student Number)
                    </Label>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 按鈕區域 */}
        <div className="flex justify-between items-center pt-6 border-t">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button onClick={handleNext} className="gap-2">
                下一步 <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handlePrev} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> 上一步
              </Button>
              <Button onClick={createCharacter} className="bg-blue-600 hover:bg-blue-700 text-white">
                建立角色
              </Button>
            </>
          )}
        </div>

        {/* 驗證失敗提示 */}
        <AlertDialog
          open={validationAlert.open}
          onOpenChange={(o) => setValidationAlert((prev) => ({ ...prev, open: o }))}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>欄位驗證失敗</AlertDialogTitle>
              <AlertDialogDescription>
                請填寫以下必填欄位：
                <ul className="mt-2 list-disc list-inside space-y-1">
                  {validationAlert.missingFields.map((field, i) => (
                    <li key={i} className="text-red-600 font-medium">
                      {field}
                    </li>
                  ))}
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setValidationAlert({ open: false, missingFields: [] })}>
                確定
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}