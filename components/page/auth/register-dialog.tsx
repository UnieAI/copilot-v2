// @/components/features/auth/register-dialog.tsx
'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, UserPlus } from "lucide-react"
import { registerUser } from "@/app/(main)/actions"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export function RegisterDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // 表單狀態
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("") // 可選：輸入頭像 URL

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !username) {
      toast.error("請填寫所有必要欄位")
      return
    }

    if (password.length < 6) {
      toast.error("密碼至少需要 6 個字元")
      return
    }

    setLoading(true)

    try {
      // 如果有輸入頭像 URL，則下載並轉 base64；否則使用預設頭像
      let avatarBase64 = ""
      if (avatarUrl) {
        try {
          const res = await fetch(avatarUrl)
          const blob = await res.blob()
          avatarBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
        } catch (err) {
          console.warn("頭像下載失敗，使用預設", err)
        }
      }

      // 呼叫 server action 註冊
      const result = await registerUser(email, password, username, avatarBase64)

      if (!result.success) {
        toast.error(result.message || "註冊失敗")
        setLoading(false)
        return
      }

      // 註冊成功後自動登入
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (signInResult?.error) {
        toast.error("自動登入失敗，請手動登入")
        setLoading(false)
        return
      }

      toast.success("註冊成功，已自動登入！")
      setOpen(false)
      router.push("/")
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error("發生未知錯誤")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <UserPlus className="h-4 w-4" />
          註冊帳號 (Dev Only)
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">開發模式註冊</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleRegister} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label htmlFor="username">使用者名稱</Label>
            <Input
              id="username"
              placeholder="請輸入暱稱"
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">電子郵件</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">密碼</Label>
            <Input
              id="password"
              type="password"
              placeholder="至少 6 個字元"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatarUrl">頭像 URL（可選）</Label>
            <Input
              id="avatarUrl"
              placeholder="https://example.com/avatar.jpg"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value.trim())}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              填入圖片網址，系統會自動下載並轉成 base64
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                註冊中...
              </>
            ) : (
              "立即註冊並登入"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}