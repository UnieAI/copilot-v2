import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AgentChatInterface } from "@/components/agent/agent-chat-interface"

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const params = await searchParams
  const sessionIdRaw = params.id
  const initialSessionId = Array.isArray(sessionIdRaw) ? sessionIdRaw[0] : sessionIdRaw

  return <AgentChatInterface initialSessionId={initialSessionId} />
}
