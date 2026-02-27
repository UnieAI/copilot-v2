"use client"

import { useSession } from "next-auth/react"
import { CharacterForm } from "@/components/page/character/character-form"
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
    <CharacterForm session={session} />
  )
}
