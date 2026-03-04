"use client"
import { useRouter } from "next/navigation"
import { Users, ChevronRight } from "lucide-react"

type GroupItem = {
    id: string
    name: string
    memberCount: number
    providerCount: number
    currentUserRole: string | null
    createdAt: string
}

const ROLE_LABELS: Record<string, string> = { creator: "創建者", editor: "共編者", member: "成員" }

export function UserGroupsPage({ groups }: { groups: GroupItem[] }) {
    const router = useRouter()

    if (groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Users className="h-7 w-7 text-muted-foreground" />
                </div>
                <h2 className="text-base font-semibold text-muted-foreground">沒有所屬群組</h2>
                <p className="text-sm text-muted-foreground/60 mt-1">你目前不屬於任何群組</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {groups.map(g => (
                <button
                    key={g.id}
                    onClick={() => router.push(`/g/${g.id}`)}
                    className="w-full text-left flex items-center gap-4 px-5 py-4 rounded-xl border border-border/50 bg-background hover:border-primary/30 hover:shadow-sm transition-all group"
                >
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold group-hover:text-primary transition-colors truncate">{g.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {g.memberCount} 位成員
                        </p>
                    </div>
                    {g.currentUserRole && (
                        <span className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary shrink-0">
                            {ROLE_LABELS[g.currentUserRole] || g.currentUserRole}
                        </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0" />
                </button>
            ))}
        </div>
    )
}
