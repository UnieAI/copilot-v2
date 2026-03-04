"use client"

import { useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Upload, User } from "lucide-react"

interface ProfileFormProps {
  initialName: string
  initialImage?: string
}

const ACCEPTED_AVATAR_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".tif", ".tiff"]
const ACCEPTED_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
]

function inferMimeFromDataUrl(dataUrl: string): string {
  const matched = /^data:([^;]+);base64,/i.exec(dataUrl)
  return matched?.[1]?.toLowerCase() || ""
}

export function ProfileForm({ initialName, initialImage }: ProfileFormProps) {
  const { update } = useSession()
  const [name, setName] = useState(initialName)
  const [imageDataUrl, setImageDataUrl] = useState(initialImage ?? "")
  const [imageMimeType, setImageMimeType] = useState("")
  const [imageExtension, setImageExtension] = useState("")
  const [avatarChanged, setAvatarChanged] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = `.${file.name.split(".").pop()?.toLowerCase() || ""}`
    const mime = file.type?.toLowerCase() || ""
    const isAccepted =
      ACCEPTED_AVATAR_EXTENSIONS.includes(ext) || ACCEPTED_AVATAR_MIME_TYPES.includes(mime)

    if (!isAccepted) {
      toast.error("頭像格式不支援，請使用 jpg/jpeg/png/gif/webp/heic/tif/tiff")
      e.target.value = ""
      return
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("讀取失敗"))
      reader.readAsDataURL(file)
    }).catch(() => "")

    if (!dataUrl) {
      toast.error("頭像讀取失敗")
      return
    }

    setImageDataUrl(dataUrl)
    setImageMimeType(mime)
    setImageExtension(ext)
    setAvatarChanged(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("請輸入顯示名稱")
      return
    }

    setSaving(true)
    try {
      const payload: {
        name: string
        image?: string | null
        imageMimeType?: string | null
        imageExtension?: string | null
      } = {
        name: name.trim(),
      }

      if (avatarChanged) {
        payload.image = imageDataUrl || null
        payload.imageMimeType = (imageMimeType || inferMimeFromDataUrl(imageDataUrl)) || null
        payload.imageExtension = imageExtension || null
      }

      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error("更新失敗")

      const data = await res.json().catch(() => null)
      const updatedName = typeof data?.name === "string" ? data.name : name.trim()
      const updatedImage = avatarChanged
        ? data?.image === null
          ? null
          : typeof data?.image === "string"
            ? data.image
            : imageDataUrl || null
        : imageDataUrl || null

      await update({ user: { name: updatedName } } as any)
      window.dispatchEvent(
        new CustomEvent("user:profile-updated", {
          detail: { name: updatedName, image: updatedImage },
        })
      )
      setAvatarChanged(false)
      toast.success("個人資料已更新")
    } catch {
      toast.error("更新失敗，請稍後再試")
    } finally {
      setSaving(false)
    }
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col items-center gap-4">
        {/* 頭像上傳區域 */}
        <label
          htmlFor="avatar-upload"
          className="group relative cursor-pointer transition-all"
        >
          <div className="relative">
            {imageDataUrl ? (
              <img
                src={imageDataUrl}
                alt="頭像預覽"
                className="h-28 w-28 rounded-full object-cover shadow-md ring-2 ring-offset-2 ring-primary/30 transition-all group-hover:ring-primary/60 group-hover:scale-105"
              />
            ) : (
              <div className="h-28 w-28 rounded-full bg-muted flex items-center justify-center text-muted-foreground shadow-md ring-2 ring-offset-2 ring-primary/20 transition-all group-hover:ring-primary/50 group-hover:scale-105">
                <User size={48} strokeWidth={1.8} />
              </div>
            )}

            {/* hover 時出現的上傳遮罩 */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Upload className="text-white" size={32} strokeWidth={2} />
            </div>
          </div>

          <p className="text-sm text-muted-foreground mt-3 text-center group-hover:text-primary transition-colors">
            點擊更換頭像
          </p>
        </label>

        <input
          id="avatar-upload"
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_AVATAR_EXTENSIONS.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* 顯示名稱輸入 */}
        <div className="w-full max-w-md">
          <label htmlFor="name" className="block text-sm font-medium text-foreground/80 mb-1.5">
            顯示名稱
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="輸入你的顯示名稱"
            className="w-full h-11 rounded-xl border border-input bg-background px-4 text-base 
                       placeholder:text-muted-foreground
                       focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary 
                       transition-all disabled:opacity-60"
            disabled={saving}
          />
        </div>
      </div>

      {/* 格式提示 */}
      <p className="text-xs text-muted-foreground text-center">
        支援格式：jpg, jpeg, png, gif, webp, heic, tif, tiff<br />
        建議尺寸 512×512 以上，檔案大小建議小於 5MB
      </p>

      {/* 儲存按鈕 */}
      <div className="flex justify-center pt-4">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="min-w-[140px] h-11 px-8 rounded-xl bg-primary text-primary-foreground font-medium
                     hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none
                     transition-all shadow-sm"
        >
          {saving ? "儲存中..." : "儲存變更"}
        </button>
      </div>
    </form>
  )
}
