import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
    locales: ['en', 'es', 'fr', 'ja', 'zh-tw', 'zh-cn'],
    defaultLocale: 'en'
});

// Lightweight wrappers around Next.js' navigation APIs
export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);
