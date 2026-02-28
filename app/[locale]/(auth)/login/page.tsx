import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import Link from 'next/link';
import { Suspense, lazy } from 'react';
import { ExampleShowcase } from '@/components/auth/example-showcase';
import { getTranslations } from 'next-intl/server';
import { UnieAIIcon } from "@/components/sidebar/unieai-logo";

// Lazy loading animated background to avoid heavy JS blocking on initial render
const AnimatedBg = lazy(() => import('@/components/ui/animated-bg').then(mod => ({ default: mod.AnimatedBg })));

export default async function LoginPage() {
    const session = await auth();
    if (session?.user) redirect('/chat');

    const t = await getTranslations('Login');

    return (
        <div className="min-h-[100dvh] bg-background relative">
            {/* Logo Link in top left */}
            <div className="absolute top-4 sm:top-6 left-4 sm:left-6 z-10">
                <Link href="/" className="flex items-center space-x-2">
                    <div className="flex flex-row items-center gap-2">
                        <UnieAIIcon className="sm:w-7 sm:h-7" />
                        <span className="font-semibold tracking-tight text-foreground">UnieAI</span>
                    </div>
                </Link>
            </div>

            <div className="flex min-h-[100dvh]">
                {/* Left Side - Auth */}
                <div className="relative flex-1 flex items-center justify-center px-4 py-16 sm:p-8">
                    <div className="w-full max-w-[340px]">
                        <div className="mb-8 flex flex-col items-center justify-center space-y-2">
                            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground text-center">
                                {t('welcomeBack')}
                            </h1>
                            <p className="text-sm text-muted-foreground text-center">
                                {t('signInToAccount')}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {/* Google Sign In */}
                            <form action={async () => {
                                "use server"
                                await signIn("google", { redirectTo: "/chat" })
                            }}>
                                <button type="submit" className="w-full relative flex h-11 sm:h-12 items-center justify-center gap-3 overflow-hidden rounded-xl border border-border bg-card hover:bg-muted/50 px-4 text-[15px] font-medium transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                    <svg className="h-5 w-5 absolute left-4" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    {t('continueWithGoogle')}
                                </button>
                            </form>

                            {/* Microsoft/Azure Sign In */}
                            <form action={async () => {
                                "use server"
                                await signIn("azure-ad", { redirectTo: "/chat" })
                            }}>
                                <button type="submit" className="w-full relative flex h-11 sm:h-12 items-center justify-center gap-3 overflow-hidden rounded-xl border border-border bg-card hover:bg-muted/50 px-4 text-[15px] font-medium transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                    <svg className="h-5 w-5 absolute left-4" viewBox="0 0 23 23" fill="none">
                                        <path d="M1 1h10v10H1z" fill="#f25022" />
                                        <path d="M12 1h10v10H12z" fill="#7fba00" />
                                        <path d="M1 12h10v10H1z" fill="#00a4ef" />
                                        <path d="M12 12h10v10H12z" fill="#ffb900" />
                                    </svg>
                                    {t('continueWithMicrosoft')}
                                </button>
                            </form>
                        </div>

                        <div className="mt-8 text-center text-xs text-muted-foreground leading-relaxed">
                            {t('termsPart1')}
                            <a href="#" className="underline underline-offset-2 hover:text-foreground">{t('termsOfService')}</a>
                            {t('termsPart2')}
                            <a href="#" className="underline underline-offset-2 hover:text-foreground">{t('privacyPolicy')}</a>
                            {t('termsPart3')}
                        </div>
                    </div>
                </div>

                {/* Right Side - Suna Visuals */}
                <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden bg-accent/5">
                    <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-accent/10" />
                    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                        <Suspense fallback={null}>
                            <AnimatedBg
                                variant="hero"
                                customArcs={{
                                    left: [
                                        { pos: { left: -120, top: 150 }, opacity: 0.15 },
                                        { pos: { left: -120, top: 400 }, opacity: 0.18 },
                                    ],
                                    right: [
                                        { pos: { right: -150, top: 50 }, opacity: 0.2 },
                                        { pos: { right: 10, top: 650 }, opacity: 0.17 },
                                    ]
                                }}
                            />
                        </Suspense>
                    </div>

                    <ExampleShowcase />
                </div>
            </div>
        </div>
    )
}
