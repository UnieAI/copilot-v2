import { authConfig } from '@/app/(auth)/auth.config';
import NextAuth from 'next-auth';
import { headers } from 'next/headers';


const { handlers: { GET, POST } } = NextAuth({
    ...authConfig,
    callbacks: {
        ...authConfig.callbacks,

        async redirect({ url, baseUrl }) {
            const h = await headers();
            const proto = h.get('x-forwarded-proto') || 'https';
            const host = h.get('x-forwarded-host') || h.get('host');
            const realBaseUrl = `${proto}://${host}`;

            if (url.startsWith('/')) return `${realBaseUrl}${url}`;
            if (new URL(url).origin === realBaseUrl) return url;
            return realBaseUrl;
        },
    },
})

export { GET, POST };
