"use client"

import type React from "react"
import { useEffect, useState } from "react"
import type { CharacterType } from "@/utils/character/type"
import {
  Gender,
  type BloodType,
  type PersonalityType,
  GENDER_OPTIONS,
  BLOOD_TYPE_OPTIONS,
  PERSONALITY_OPTIONS,
} from "@/utils/character"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, Star, Mars, Venus, ArrowLeft, ArrowRight } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"

import { handleOnBirthdayChange } from "@/utils/character/functions"
import { handleDrag, handleDrop, handleImageUpload } from "@/utils/character/character-image/functions"

import { ActionUpdateCharacter } from "@/app/(main)/actions"
import { toast } from "sonner"

interface Props {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  fetchData: () => Promise<void>
  selectCharacter: CharacterType
  setSelectCharacter: React.Dispatch<React.SetStateAction<CharacterType>>
}

export const EditCharacterDialog = ({
  open,
  setOpen,
  fetchData,
  selectCharacter,
  setSelectCharacter,
}: Props) => {
  const [step, setStep] = useState<1 | 2>(1)
  const [dragActive, setDragActive] = useState<boolean>(false)
  const [validationAlert, setValidationAlert] = useState<{
    open: boolean
    missingFields: string[]
  }>({
    open: false,
    missingFields: [],
  })

  const isFemale = selectCharacter.gender === Gender.FEMALE

  // 驗證必填欄位（第一頁）
  const validateRequiredFields = () => {
    const requiredFields = [
      { field: "image", label: "角色頭像", value: selectCharacter.image },
      { field: "name", label: "姓名", value: selectCharacter.name },
      { field: "gender", label: "性別", value: selectCharacter.gender },
      { field: "birthday", label: "生日", value: selectCharacter.birthday },
      { field: "bloodType", label: "血型", value: selectCharacter.bloodType },
      { field: "mbti", label: "MBTI", value: selectCharacter.mbti },
      // 如果你也要求 systemPrompt 必填，可以加上這一行：
      // { field: "systemPrompt", label: "System Prompt", value: selectCharacter.systemPrompt },
    ]

    const missingFields = requiredFields
      .filter(({ value }) => !value || (typeof value === "string" && value.trim() === ""))
      .map(({ label }) => label)

    if (missingFields.length > 0) {
      setValidationAlert({
        open: true,
        missingFields,
      })
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

  const updateCharacter = async () => {
    try {
      // 準備更新資料，排除 id, userId, createdAt, updatedAt 等欄位
      const { id, userId, ...updateData } = selectCharacter

      await ActionUpdateCharacter({
        id,
        ...updateData,
      })

      toast.success("角色更新成功")
      setOpen(false)
      await fetchData()
    } catch (error) {
      console.error("更新角色失敗：", error)
      toast.error("更新角色失敗，請稍後再試")
    }
  }

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {step === 1 ? "編輯角色 - 基本資訊" : "編輯角色 - 進階資訊"}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          // ── 第一頁：必填 ──
          <div className="grid gap-6 py-4">
            {/* 頭像上傳 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">角色頭像</Label>
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                  dragActive ? "border-blue-500 bg-blue-50" : "border-zinc-300 hover:border-zinc-400",
                )}
                onDragEnter={(e) => handleDrag(e, setDragActive)}
                onDragLeave={(e) => handleDrag(e, setDragActive)}
                onDragOver={(e) => handleDrag(e, setDragActive)}
                onDrop={(e) => handleDrop(e, setDragActive, setSelectCharacter)}
              >
                {selectCharacter.image ? (
                  <div className="space-y-4">
                    <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-white shadow-lg">
                      <Image
                        src={selectCharacter.image || "/placeholder.svg"}
                        alt="Preview"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectCharacter((prev) => ({ ...prev, image: "" }))}
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
                      onChange={(e) => handleImageUpload(e, setSelectCharacter)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 姓名 + 註記 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-sm font-medium">
                  姓名
                </Label>
                <Input
                  id="edit-name"
                  placeholder="輸入角色姓名"
                  value={selectCharacter.name}
                  onChange={(e) => setSelectCharacter({ ...selectCharacter, name: e.target.value })}
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tag" className="text-sm font-medium">
                  註記
                </Label>
                <Input
                  id="edit-tag"
                  placeholder="輸入角色註記"
                  value={selectCharacter.tag ?? ""}
                  onChange={(e) => setSelectCharacter({ ...selectCharacter, tag: e.target.value })}
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 性別 + 生日 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">性別</Label>
                <div className="flex gap-2">
                  {GENDER_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={selectCharacter.gender === option.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectCharacter({ ...selectCharacter, gender: option.value })}
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
                <Label className="text-sm font-medium">生日與星座</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-birthday"
                    type="date"
                    value={selectCharacter.birthday}
                    onChange={(e) => handleOnBirthdayChange(e.target.value, setSelectCharacter)}
                    className="w-1/2 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="w-1/2 flex items-center justify-center gap-2 p-2 border rounded-md">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm">{selectCharacter.zodiac || "請先選擇生日"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 血型 + MBTI */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-bloodType" className="text-sm font-medium">
                  血型
                </Label>
                <Select
                  value={selectCharacter.bloodType}
                  onValueChange={(value) => setSelectCharacter({ ...selectCharacter, bloodType: value as BloodType })}
                >
                  <SelectTrigger className="focus:ring-2 focus:ring-blue-500">
                    <SelectValue placeholder="選擇血型" />
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
                <Label htmlFor="edit-mbti" className="text-sm font-medium">
                  MBTI
                </Label>
                <Select
                  value={selectCharacter.mbti}
                  onValueChange={(value) =>
                    setSelectCharacter({ ...selectCharacter, mbti: value as PersonalityType })
                  }
                >
                  <SelectTrigger className="focus:ring-2 focus:ring-blue-500">
                    <SelectValue placeholder="選擇MBTI人格類型" />
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

            {/* System Prompt */}
            <div className="space-y-2">
              <Label htmlFor="edit-systemPrompt" className="text-sm font-medium">
                System Prompt
              </Label>
              <Textarea
                id="edit-systemPrompt"
                placeholder="描述角色的行為模式、說話風格、背景設定等..."
                value={selectCharacter.systemPrompt ?? ""}
                onChange={(e) => setSelectCharacter({ ...selectCharacter, systemPrompt: e.target.value })}
                className="min-h-[100px] focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        ) : (
          // ── 第二頁：進階（選填） ──
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label className="text-lg font-medium">進階資訊（可選填）</Label>
              <p className="text-sm text-muted-foreground">
                修改這些欄位可以讓角色更完整豐富，之後仍可繼續編輯。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>英文名 / 別名</Label>
                <Input
                  placeholder="英文名或別稱"
                  value={selectCharacter.englishName ?? ""}
                  onChange={(e) => setSelectCharacter((prev) => ({ ...prev, englishName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>出生地</Label>
                <Input
                  placeholder="出生地"
                  value={selectCharacter.birthplace ?? ""}
                  onChange={(e) => setSelectCharacter((prev) => ({ ...prev, birthplace: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>外貌描述</Label>
              <Textarea
                placeholder="角色的外貌特徵、穿著風格等"
                value={selectCharacter.appearance ?? ""}
                onChange={(e) => setSelectCharacter((prev) => ({ ...prev, appearance: e.target.value }))}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label>詳細背景 / 故事</Label>
              <Textarea
                placeholder="角色的背景故事、經歷、特殊設定等"
                value={selectCharacter.detail ?? ""}
                onChange={(e) => setSelectCharacter((prev) => ({ ...prev, detail: e.target.value }))}
                className="min-h-[100px]"
              />
            </div>

            {isFemale && (
              <>
                <div className="space-y-2">
                  <Label>教育背景 / 學歷</Label>
                  <Input
                    placeholder="就讀學校、學歷等"
                    value={selectCharacter.education ?? ""}
                    onChange={(e) => setSelectCharacter((prev) => ({ ...prev, education: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>制服細節</Label>
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="uniform-tie"
                        checked={selectCharacter.uniformDetail?.tie ?? false}
                        onCheckedChange={(checked) =>
                          setSelectCharacter((prev) => ({
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
                        checked={selectCharacter.uniformDetail?.schoolName ?? false}
                        onCheckedChange={(checked) =>
                          setSelectCharacter((prev) => ({
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
                        checked={selectCharacter.uniformDetail?.name ?? false}
                        onCheckedChange={(checked) =>
                          setSelectCharacter((prev) => ({
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
                        checked={selectCharacter.uniformDetail?.studentNumber ?? false}
                        onCheckedChange={(checked) =>
                          setSelectCharacter((prev) => ({
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
                </div>
              </>
            )}
          </div>
        )}

        {/* 按鈕區域 */}
        <div className="flex justify-between items-center pt-4 border-t">
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
              <Button onClick={updateCharacter} className="bg-blue-600 hover:bg-blue-700 text-white">
                更新角色
              </Button>
            </>
          )}
        </div>

        {/* 驗證失敗提示 */}
        <AlertDialog
          open={validationAlert.open}
          onOpenChange={(open) => setValidationAlert((prev) => ({ ...prev, open }))}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>欄位驗證失敗</AlertDialogTitle>
              <AlertDialogDescription>
                請填寫以下必填欄位：
                <ul className="mt-2 list-disc list-inside space-y-1">
                  {validationAlert.missingFields.map((field, index) => (
                    <li key={index} className="text-red-600 font-medium">
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