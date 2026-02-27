"use client"

import { useSession } from "next-auth/react"
import { ChatRoomForm } from "@/components/page/chat-room/chat-room-form"
import AuthRequired from "@/components/shared/auth-required"
import AuthLoading from "@/components/shared/auth-loading"

export default function Page() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <AuthLoading />
  }

  if (!session) {
    return <AuthRequired />
  }

  return (
    <ChatRoomForm session={session} />
  )
}
