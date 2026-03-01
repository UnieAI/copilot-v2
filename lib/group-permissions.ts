import { auth } from "@/auth";
import { db } from "@/lib/db";
import { userGroups } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export type GroupRole = "creator" | "editor" | "member";

export const isAdminSession = (session: Awaited<ReturnType<typeof auth>>) => {
    const role = (session?.user as any)?.role as string | undefined;
    return !!session?.user && ["admin", "super"].includes(role || "");
};

export const isGroupEditorRole = (role?: string | null) => role === "creator" || role === "editor";

export async function getGroupMembership(userId: string, groupId: string) {
    return db.query.userGroups.findFirst({
        where: and(eq(userGroups.userId, userId), eq(userGroups.groupId, groupId)),
    });
}

export async function requireGroupMember(groupId: string) {
    const session = await auth();
    if (!session?.user?.id) return null;
    if (isAdminSession(session)) return session;

    const membership = await getGroupMembership(session.user.id as string, groupId);
    if (!membership) return null;
    return session;
}

export async function requireGroupEditor(groupId: string) {
    const session = await auth();
    if (!session?.user?.id) return null;
    if (isAdminSession(session)) return session;

    const membership = await getGroupMembership(session.user.id as string, groupId);
    if (!isGroupEditorRole(membership?.role)) return null;
    return session;
}

export async function requireGroupCreator(groupId: string) {
    const session = await auth();
    if (!session?.user?.id) return null;
    if (isAdminSession(session)) return session;

    const membership = await getGroupMembership(session.user.id as string, groupId);
    if (membership?.role !== "creator") return null;
    return session;
}
