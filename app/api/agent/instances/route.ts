import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { getRunningInstances } from "@/lib/opencode/instances"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const instances = getRunningInstances()
    return NextResponse.json({ total: instances.length, instances })
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to read instances", details: e?.message || "Unknown error" },
      { status: 500 }
    )
  }
}
