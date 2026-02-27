"use client"

import { useSession } from "next-auth/react"
import AuthRequired from "@/components/shared/auth-required"
import AuthLoading from "@/components/shared/auth-loading"
import { HomePage } from "@/components/page/home/home-page"

export default function Page() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <AuthLoading />
  }

  if (!session) {
    return <AuthRequired />
  }

  return (
    <HomePage />
  )
}
