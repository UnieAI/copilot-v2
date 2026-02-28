"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

interface ProfileFormProps {
    initialName: string
}

export function ProfileForm({ initialName }: ProfileFormProps) {
    const { update } = useSession()
    const [name, setName] = useState(initialName)
    const [saving, setSaving] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return
        setSaving(true)
        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            })
            if (!res.ok) throw new Error("Failed")
            // Trigger session.update() so next-auth JWT callback re-fetches name
            // and useSession() in the sidebar reflects the new name immediately
            await update({ name: name.trim() })
            toast.success("名稱已更新")
        } catch {
            toast.error("更新失敗")
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex gap-3">
            <input
                name="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="您的名稱"
                className="flex-1 h-10 rounded-xl border border-input/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
            />
            <button
                type="submit"
                disabled={saving}
                className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-60"
            >
                {saving ? "儲存中..." : "儲存"}
            </button>
        </form>
    )
}
