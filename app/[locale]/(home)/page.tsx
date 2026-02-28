'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Send, Search, Image as ImageIcon, FileText, Code2, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { DynamicGreeting } from '@/components/ui/dynamic-greeting';

export default function Home() {
    const router = useRouter();
    const t = useTranslations('Home');
    const tHeader = useTranslations('Header');
    const [inputValue, setInputValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const handleDragOver = (e: React.DragEvent) => {
        if (e.dataTransfer?.types?.includes('Files')) {
            e.preventDefault();
        }
    };
    const handleDrop = (e: React.DragEvent) => {
        if (e.dataTransfer?.types?.includes('Files')) {
            e.preventDefault();
        }
    };

    // Check login status on mount
    useEffect(() => {
        async function checkAuth() {
            try {
                const session = await getSession();
                setIsLoggedIn(!!session?.user);
            } catch (error) {
                console.error('Failed to get session:', error);
            } finally {
                setIsCheckingAuth(false);
            }
        }
        checkAuth();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        if (isLoggedIn) {
            // If logged in, create a new chat passing the query
            router.push(`/chat?q=${encodeURIComponent(inputValue.trim())}`);
        } else {
            // If not logged in, redirect to login
            router.push(`/login?q=${encodeURIComponent(inputValue.trim())}`);
        }
    };

    return (
        <section
            id="hero"
            className="w-full h-full relative overflow-hidden bg-background"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Simple Header */}
            <header className="absolute top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between">
                <div />
                <div className="flex items-center gap-4">
                    <Link href="/tutorials" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                        {tHeader('tutorials')}
                    </Link>
                    {!isCheckingAuth && !isLoggedIn && (
                        <Link href="/login">
                            <Button variant="default" size="sm" className="rounded-full shadow-sm">
                                <LogIn className="w-4 h-4 mr-2" />
                                {tHeader('login')}
                            </Button>
                        </Link>
                    )}
                    {!isCheckingAuth && isLoggedIn && (
                        <Link href="/chat">
                            <Button variant="outline" size="sm" className="rounded-full shadow-sm">
                                {tHeader('goToChat')}
                            </Button>
                        </Link>
                    )}
                </div>
            </header>

            <div className="flex flex-col h-full w-full overflow-hidden relative">
                {/* Brandmark Background */}
                <div
                    className="absolute inset-0 pointer-events-none overflow-hidden"
                    aria-hidden="true"
                >
                    <img
                        src="/kortix-brandmark-bg.svg"
                        alt=""
                        className="absolute left-1/2 -translate-x-1/2 top-[-10%] sm:top-1/2 sm:-translate-y-1/2 w-[140vw] min-w-[700px] h-auto sm:w-[160vw] sm:min-w-[1000px] md:min-w-[1200px] lg:w-[162vw] lg:min-w-[1620px] object-contain select-none invert dark:invert-0 opacity-80"
                        draggable={false}
                    />
                </div>

                {/* Main content area */}
                <div className="flex-1 flex flex-col relative z-[1] justify-center mt-12">
                    <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center px-4">

                        <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 fill-mode-both">
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium text-foreground tracking-tight">
                                <DynamicGreeting />
                            </h1>
                        </div>

                        <p className="mt-4 sm:mt-5 text-sm sm:text-base text-muted-foreground/70 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-75 fill-mode-both">
                            {t('subtitle')}
                        </p>

                        <div className="mt-8 flex flex-wrap justify-center gap-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both max-w-lg">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/50 bg-background/50 hover:bg-accent cursor-pointer transition-colors backdrop-blur-md text-foreground">
                                <Search className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{t('research')}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/50 bg-background/50 hover:bg-accent cursor-pointer transition-colors backdrop-blur-md text-foreground">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{t('documents')}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/50 bg-background/50 hover:bg-accent cursor-pointer transition-colors backdrop-blur-md text-foreground">
                                <Code2 className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{t('code')}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/50 bg-background/50 hover:bg-accent cursor-pointer transition-colors backdrop-blur-md text-foreground">
                                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{t('images')}</span>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Chat Input */}
                <div className="w-full max-w-3xl mx-auto px-4 pb-8 relative z-10 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
                    <form onSubmit={handleSubmit} className={cn(
                        "relative flex flex-col w-full bg-background/90 backdrop-blur-xl border rounded-[24px] shadow-sm transition-all duration-200 overflow-hidden",
                        isFocused ? "border-primary/50 shadow-md ring-1 ring-primary/20" : "border-border/50"
                    )}>
                        <div className="relative flex flex-col w-full min-h-[120px] p-2">
                            <textarea
                                className="w-full flex-1 resize-none bg-transparent px-3 py-3 outline-none min-h-[80px] text-foreground placeholder:text-muted-foreground/50"
                                placeholder={t('placeholder')}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if (inputValue.trim()) {
                                            handleSubmit(e);
                                        }
                                    }
                                }}
                            />

                            <div className="flex items-center justify-between p-1 mt-auto">
                            <div className="flex items-center gap-2">
                                <Button
                                    type="submit"
                                        size="icon"
                                        className={cn(
                                            "h-9 w-9 rounded-full transition-all flex items-center justify-center",
                                            inputValue.trim() ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground pointer-events-none"
                                        )}
                                        disabled={!inputValue.trim()}
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </form>

                    <div className="mt-4 text-center text-xs text-muted-foreground">
                        <span className="opacity-70">{t('concept')}</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
