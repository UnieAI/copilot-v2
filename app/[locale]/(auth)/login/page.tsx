import { signIn } from "@/auth"

export default function LoginPage() {
    return (
        <div className="flex bg-background h-screen w-screen items-center justify-center">
            <div className="flex flex-col border p-12 rounded-lg gap-4 text-center">
                <h1 className="font-bold text-3xl">UnieAI Copilot</h1>
                <p className="text-muted-foreground">Sign in to continue</p>
                <div className="flex flex-col gap-2 mt-4">
                    <form
                        action={async () => {
                            "use server"
                            await signIn("google")
                        }}
                    >
                        <button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 font-medium">Signin with Google</button>
                    </form>
                    <form
                        action={async () => {
                            "use server"
                            await signIn("azure-ad")
                        }}
                    >
                        <button type="submit" className="w-full border bg-background hover:bg-accent hover:text-accent-foreground rounded-md px-4 py-2 font-medium mt-2">Signin with Azure AD</button>
                    </form>
                </div>
            </div>
        </div>
    )
}
