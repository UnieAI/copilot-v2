import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';
import { isDevelopment } from './utils';

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

  // 2. 定義公開路由（不需要登入就能訪問）
  const publicRoutes = ['/', '/model', '/login', '/register', '/website'];
  const isPublicRoute = publicRoutes.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // 3. 取得認證 token
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isHttps = forwardedProto === 'https';

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: isHttps,
  });

  // 開發環境除錯用（可之後移除）
  if (isDevelopment) {
    console.log('Middleware - pathname:', pathname);
    console.log('Middleware - token:', token ? 'exists' : 'null');
    console.log('Middleware - isPublicRoute:', isPublicRoute);
    console.log(
      'Middleware - forwarded proto:', forwardedProto,
      'forwarded host:', forwardedHost,
      'host header:', request.headers.get('host')
    );
  }

  // 計算正確的 base URL（考慮反向代理 / Vercel 等情況）
  const host = forwardedHost ?? request.headers.get('host')!;
  const proto = forwardedProto ?? 'http';
  const baseHost = `${proto}://${host}`;

  // 4. 未登入 + 非公開頁面 → 導向登入頁
  if (!token && !isPublicRoute) {
    const originalPath = request.nextUrl.pathname + request.nextUrl.search;
    const originalFull = `${baseHost}${originalPath}`;
    const redirectUrl = encodeURIComponent(originalFull);

    if (isDevelopment) {
      console.log('Redirecting to login, redirectUrl:', redirectUrl, 'baseHost:', baseHost);
    }

    return NextResponse.redirect(
      new URL(`/login?redirectUrl=${redirectUrl}`, baseHost)
    );
  }

  // 5. 已登入但在登入/註冊頁 → 導向首頁或原先想去的頁面
  if (token && (pathname === '/login')) {
    const redirectUrl = request.nextUrl.searchParams.get('redirectUrl');
    const targetUrl = redirectUrl ? decodeURIComponent(redirectUrl) : '/';

    if (isDevelopment) {
      console.log('User already logged in, redirecting to:', targetUrl);
    }

    return NextResponse.redirect(new URL(targetUrl, baseHost));
  }

  // 6. 正常情況：繼續處理請求
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路徑，但排除：
     * - /api routes
     * - /_next (Next.js 內部資源)
     * - /_vercel (Vercel 相關)
     * - 包含 . 的檔案（靜態資源）
     */
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};