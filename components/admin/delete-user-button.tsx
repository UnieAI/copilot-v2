"use client"

interface DeleteUserButtonProps {
    userId: string
    userName: string
    deleteAction: (formData: FormData) => Promise<void>
}

export function DeleteUserButton({ userId, userName, deleteAction }: DeleteUserButtonProps) {
    return (
        <form
            action={deleteAction}
            onSubmit={(e) => {
                if (!confirm(`確定要刪除使用者「${userName}」嗎？此操作無法復原。`)) {
                    e.preventDefault()
                }
            }}
        >
            <input type="hidden" name="userId" value={userId} />
            <button
                type="submit"
                className="h-7 px-2.5 text-xs rounded-md border border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
                刪除
            </button>
        </form>
    )
}
