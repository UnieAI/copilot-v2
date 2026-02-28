import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 放行 public assets、API routes 和靜態檔案
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.') // 包含 . 的檔案（圖片、favicon、js 等）
  ) {
    return NextResponse.next();
  }

  // 2. 國際化 Middleware 處理
  // next-intl 會自動處理 /[locale]/... 以及重定向
  const response = intlMiddleware(request);

  // 3. 取得認證 token
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isHttps = forwardedProto === 'https';

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: isHttps,
  });

  // 4. 解析當前的 locale 和實際路徑
  // 例如 /zh-tw/login -> locale: zh-tw, pathWithoutLocale: /login
  const pathParts = pathname.split('/').filter(Boolean);
  const currentLocale = routing.locales.includes(pathParts[0] as any) ? pathParts[0] : '';
  const pathWithoutLocale = currentLocale ? `/${pathParts.slice(1).join('/')}` : pathname;

  // Suna public routes merged with original
  const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/auth',
    '/legal',
    '/share',
    '/templates',
    '/support',
    '/suna',
    '/help',
    '/agents-101',
    '/about',
    '/milano',
    '/berlin',
    '/app',
    '/careers',
    '/pricing',
    '/tutorials',
    '/countryerror'
  ];
  
  const isPublicRoute = publicRoutes.some(route =>
    pathWithoutLocale === route || pathWithoutLocale.startsWith(`${route}/`) || pathWithoutLocale === ''
  );

  const host = forwardedHost ?? request.headers.get('host')!;
  const proto = forwardedProto ?? 'http';
  const baseHost = `${proto}://${host}`;

  // 5. 權限導向邏輯
  if (!token && !isPublicRoute) {
    const originalPath = request.nextUrl.pathname + request.nextUrl.search;
    const originalFull = `${baseHost}${originalPath}`;
    const redirectUrl = encodeURIComponent(originalFull);
    const loginUrl = currentLocale ? `/${currentLocale}/login` : '/login';

    return NextResponse.redirect(
      new URL(`${loginUrl}?redirectUrl=${redirectUrl}`, baseHost)
    );
  }

  if (token && pathWithoutLocale === '/login') {
    const redirectUrl = request.nextUrl.searchParams.get('redirectUrl');
    const targetUrl = redirectUrl ? decodeURIComponent(redirectUrl) : (currentLocale ? `/${currentLocale}/` : '/');
    return NextResponse.redirect(new URL(targetUrl, baseHost));
  }

  // 若是 pending 狀態，強迫導向 /pending
  if (token && token.role === 'pending' && pathWithoutLocale !== '/pending') {
    const pendingUrl = currentLocale ? `/${currentLocale}/pending` : '/pending';
    return NextResponse.redirect(new URL(pendingUrl, baseHost));
  }

  return response;
}

export const config = {
  matcher: [
    // 匹配所有的路徑，但排除內部資源與靜態檔案
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};