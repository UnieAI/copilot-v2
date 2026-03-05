"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

type UserActionResult = {
    success: boolean
    message: string
}

interface DeleteUserButtonProps {
    userId: string
    userName: string
    deleteAction: (formData: FormData) => Promise<UserActionResult>
}

export function DeleteUserButton({ userId, userName, deleteAction }: DeleteUserButtonProps) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                if (!confirm(`確定要刪除使用者 ${userName} 嗎？此操作無法復原。`)) {
                    return
                }

                const formData = new FormData(e.currentTarget)
                startTransition(() => {
                    void (async () => {
                        const result = await deleteAction(formData)
                        if (result.success) toast.success(result.message)
                        else toast.error(result.message)
                        router.refresh()
                    })()
                })
            }}
        >
            <input type="hidden" name="userId" value={userId} />
            <button
                type="submit"
                disabled={isPending}
                className="h-7 px-2.5 text-xs rounded-md border border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
                刪除
            </button>
        </form>
    )
}

