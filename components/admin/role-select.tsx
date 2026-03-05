"use client"

import { useRef, useTransition } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

type UserActionResult = {
    success: boolean
    message: string
}

interface RoleSelectProps {
    userId: string
    currentRole: string
    changeAction: (formData: FormData) => Promise<UserActionResult>
}

export function RoleSelect({ userId, currentRole, changeAction }: RoleSelectProps) {
    const formRef = useRef<HTMLFormElement>(null)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleChange = () => {
        const form = formRef.current
        if (!form) return

        const formData = new FormData(form)
        startTransition(() => {
            void (async () => {
                const result = await changeAction(formData)
                if (result.success) toast.success(result.message)
                else toast.error(result.message)
                router.refresh()
            })()
        })
    }

    return (
        <form ref={formRef}>
            <input type="hidden" name="userId" value={userId} />
            <select
                name="role"
                defaultValue={currentRole}
                disabled={isPending}
                onChange={handleChange}
                className="h-9 rounded-xl border border-input/60 bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium disabled:opacity-50 disabled:cursor-wait"
            >
                <option value="pending">待審核</option>
                <option value="user">一般使用者</option>
                <option value="admin">管理員</option>
            </select>
        </form>
    )
}

