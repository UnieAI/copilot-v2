import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { userPhotos, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const ACCEPTED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
])

const ACCEPTED_AVATAR_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".tif",
  ".tiff",
])

/** GET /api/user/profile - read current user profile */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })
  const userId = session.user.id as string

  const rows = await db
    .select({
      name: users.name,
      email: users.email,
      image: userPhotos.image,
    })
    .from(users)
    .leftJoin(userPhotos, eq(userPhotos.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1)
  const dbUser = rows[0]
  if (!dbUser) return new Response("Not found", { status: 404 })

  return Response.json({
    name: dbUser.name ?? null,
    email: dbUser.email ?? null,
    image: dbUser.image ?? null,
  })
}

/** PATCH /api/user/profile - update display name and avatar */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })
  const userId = session.user.id as string

  const body = await req.json().catch(() => ({}))
  const name = (body.name as string)?.trim()
  if (!name) return new Response("Name is required", { status: 400 })

  const image = body.image as string | null | undefined
  const imageMimeType = (body.imageMimeType as string | null | undefined)?.toLowerCase() || ""
  const imageExtension = (body.imageExtension as string | null | undefined)?.toLowerCase() || ""

  let sanitizedImage: string | null | undefined = undefined
  if (typeof image === "string" && image.trim()) {
    if (!ACCEPTED_AVATAR_MIME_TYPES.has(imageMimeType) && !ACCEPTED_AVATAR_EXTENSIONS.has(imageExtension)) {
      return new Response("Unsupported avatar format", { status: 400 })
    }
    if (imageMimeType && !image.startsWith(`data:${imageMimeType};base64,`)) {
      return new Response("Invalid image payload", { status: 400 })
    }
    if (!image.startsWith("data:")) {
      return new Response("Invalid image payload", { status: 400 })
    }
    sanitizedImage = image
  } else if (image === null) {
    sanitizedImage = null
  }

  await db
    .update(users)
    .set({ name })
    .where(eq(users.id, userId))

  if (sanitizedImage !== undefined) {
    await db
      .insert(userPhotos)
      .values({
        userId,
        image: sanitizedImage,
      })
      .onConflictDoUpdate({
        target: userPhotos.userId,
        set: {
          image: sanitizedImage,
          updatedAt: new Date(),
        },
      })
  }

  return Response.json({ ok: true, name, image: sanitizedImage ?? null })
}
