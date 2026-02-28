"use client"

import { useRef, useTransition } from "react"

interface RoleSelectProps {
    userId: string
    currentRole: string
    changeAction: (formData: FormData) => Promise<void>
}

export function RoleSelect({ userId, currentRole, changeAction }: RoleSelectProps) {
    const formRef = useRef<HTMLFormElement>(null)
    const [isPending, startTransition] = useTransition()

    const handleChange = () => {
        const form = formRef.current
        if (!form) return
        const formData = new FormData(form)
        startTransition(() => changeAction(formData))
    }

    return (
        <form ref={formRef} action={changeAction}>
            <input type="hidden" name="userId" value={userId} />
            <select
                name="role"
                defaultValue={currentRole}
                disabled={isPending}
                onChange={handleChange}
                className="h-9 rounded-xl border border-input/60 bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium disabled:opacity-50 disabled:cursor-wait"
            >
                <option value="pending">待審核</option>
                <option value="user">用戶</option>
                <option value="admin">管理員</option>
            </select>
        </form>
    )
}
