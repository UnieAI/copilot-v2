import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, userPhotos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isAdminSession } from "@/lib/group-permissions";

// GET /api/admin/users — list all users (admin/super only)
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return new Response("Forbidden", { status: 403 });
    if (!isAdminSession(session)) return new Response("Forbidden", { status: 403 });

    const allUsers = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            image: userPhotos.image,
        })
        .from(users)
        .leftJoin(userPhotos, eq(userPhotos.userId, users.id))
        .orderBy(users.createdAt);

    return Response.json(allUsers);
}
