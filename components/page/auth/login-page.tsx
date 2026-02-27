// @/components/features/auth/google-login-page.tsx
'use client'

import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from "framer-motion"
import React, { useState } from 'react';
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { toast } from "sonner"
import { isDevelopment } from "@/utils"
import { Loader2, ArrowRight, ShieldCheck, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils";

import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import PixelBlast from "@/components/shared/PixelBlast";

// 引入 server action 用來註冊使用者（假設你有這個 action，從原 register-page 借用）
import { registerUser } from "@/app/(main)/actions";
import { RegisterDialog } from "./register-dialog";

// --- UI Components ---

// 1. Dot Background (Subtle Grid)
const DotBackground = () => (
  <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.3] dark:opacity-[0.2]" style={{
    backgroundImage: 'radial-gradient(#a1a1aa 1px, transparent 1px)',
    backgroundSize: '24px 24px'
  }} />
);

// 2. Loading Overlay
const LoadingOverlay = () => (
  <motion.div
    initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
    animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
    exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
    className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 dark:bg-zinc-950/60"
  >
    <div className="flex flex-col items-center space-y-4">
      <div className="relative flex h-12 w-12">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-12 w-12 bg-zinc-900 dark:bg-white flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-white dark:text-black animate-spin" />
        </span>
      </div>
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 animate-pulse">
        connecting...
      </p>
    </div>
  </motion.div>
)

// 3. Spotlight Card Wrapper
function SpotlightCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <div
      className={cn(
        "group relative border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black overflow-hidden rounded-3xl shadow-xl",
        className
      )}
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
              radial-gradient(
                500px circle at ${mouseX}px ${mouseY}px,
                rgba(161, 161, 170, 0.1),
                transparent 80%
              )
            `,
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

// 4. Rich Social Button (The "Card" Button)
const SocialLoginButton = ({
  icon,
  title,
  subtitle,
  onClick,
  disabled
}: {
  icon: React.ReactNode,
  title: string,
  subtitle: string,
  onClick: () => void,
  disabled: boolean
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group relative flex w-full items-center gap-4 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 shadow-sm group-hover:scale-105 transition-transform duration-200">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
          {subtitle}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 group-hover:translate-x-1 transition-all duration-200" />
    </button>
  )
}

// --- Main Component ---

interface LoginProp {
  redirectUrl: string;
}

const Login = ({ redirectUrl }: LoginProp) => {
  const router = useRouter();
  const [loginLoading, setLoginLoading] = useState(false);

  // --- Handlers (Simplified for Prod) ---

  const [_email, setEmail] = useState("");
  const [_password, setPassword] = useState("");

  const handleDevelopment = async () => {
    if (_email === "" || _password === "") return;

    setLoginLoading(true);
    try {
      const email = _email;
      const password = _password;

      await signIn("credentials", {
        email,
        password,
        redirect: true,
        callbackUrl: redirectUrl,
      });
      router.push("/");
      setLoginLoading(false);
      return;
    } catch (error) {
      console.error(error);
      toast.error("Cancelled");
      setLoginLoading(false);
      return false;
    }
  };

  const handleGetGoogleAccount = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoginLoading(true);
      try {
        const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const user = await userInfoResponse.json();
        if (isDevelopment) console.log(`google user: `, user);
        const email = user.email;
        const password = user.sub; // 使用 Google sub 作為密碼
        const username = user.name || user.email.split('@')[0]; // 使用 Google name 或 email 前綴作為 username
        const avatarUrl = user.picture; // Google 提供的頭像 URL

        // 下載頭像並轉成 base64（因為原 registerUser 期待 base64）
        let avatarBase64 = "";
        if (avatarUrl) {
          const response = await fetch(avatarUrl);
          const blob = await response.blob();
          avatarBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }

        // 嘗試註冊使用者（如果已存在，registerUser 應該處理或返回錯誤，我們假設它會檢查）
        // 注意：你需要在 registerUser server action 中修改邏輯，檢查 email 是否存在，如果存在就 skip 或返回 success
        const registerResult = await registerUser(email, password, username, avatarBase64);

        if (!registerResult.success) {
          // 如果註冊失敗（例如已存在），我們還是繼續 signIn，因為可能是登入
          console.warn("User may already exist, proceeding to sign in.");
        }

        // 無論註冊是否新創，繼續 signIn
        const signInResult = await signIn("credentials", {
          email,
          password,
          redirect: true,
          callbackUrl: redirectUrl,
        });

        if (signInResult?.error) {
          toast.error(`登入失敗: ${signInResult.error}`);
          setLoginLoading(false);
          return;
        }

        // 成功導向
        router.push("/");
        setLoginLoading(false);
        return;
      } catch (error) {
        console.error(error);
        toast.error(`Google 登入失敗: ${error}`);
        setLoginLoading(false);
      }
    },
    onError: () => {
      toast.error("Google 登入失敗");
      setLoginLoading(false);
    }
  });

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2 overflow-hidden bg-white dark:bg-black">

      {/* --- Left Side: Clean Authentication Interface --- */}
      <div className="relative flex flex-col justify-center p-8 lg:p-16 z-10 bg-white dark:bg-black">
        <DotBackground />

        {/* Loading Overlay */}
        <AnimatePresence>
          {loginLoading && <LoadingOverlay />}
        </AnimatePresence>

        {/* Top Logo */}
        <div className="absolute top-8 left-8 lg:left-12 flex items-center gap-2.5">
          {/* <div className="h-9 w-9 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black">
                <Command className="h-5 w-5" />
            </div> */}
          <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Multi AI Chatroom</span>
        </div>

        <div className="w-full max-w-[420px] mx-auto relative z-20">

          {/* Main Content */}
          <div className="mb-10">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3">
              登入您的工作區
            </h1>
            <p className="text-lg text-zinc-500 dark:text-zinc-400 font-light">
              歡迎回來~請登入 Google 進行身份驗證以繼續訪問本網站。
            </p>
          </div>

          {isDevelopment && (
            <SpotlightCard className="p-4 mb-6 bg-white dark:bg-zinc-950/50 backdrop-blur-sm">
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-sm text-zinc-500 dark:text-zinc-400 mb-1 block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={_email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 ring-zinc-300 dark:ring-zinc-700"
                    placeholder="Enter your email"

                  />
                </div>

                <div>
                  <label className="text-sm text-zinc-500 dark:text-zinc-400 mb-1 block">
                    Password
                  </label>
                  <input
                    type="password"
                    autoComplete='new-password'
                    value={_password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 ring-zinc-300 dark:ring-zinc-700"
                    placeholder="Enter your password"
                  />
                </div>

                <button
                  onClick={handleDevelopment}
                  disabled={loginLoading}
                  className={cn(
                    "w-full py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all",
                    "bg-zinc-900 text-white dark:bg-white dark:text-black hover:opacity-90",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {loginLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      登入中…
                    </>
                  ) : (
                    <>以帳號密碼登入（Dev Only）</>
                  )}
                </button>
              </div>

              <div className="mt-6">
                <RegisterDialog />
              </div>
            </SpotlightCard>
          )}


          {/* Spotlight Container for Buttons */}
          <SpotlightCard className="p-2 bg-white dark:bg-zinc-950/50 backdrop-blur-sm">
            <div className="flex flex-col gap-2 p-2">

              {/* Google Button */}
              <SocialLoginButton
                onClick={() => handleGetGoogleAccount()}
                disabled={loginLoading}
                title={'使用 Google 登入'}
                subtitle={'選擇您的 Google 帳戶'}
                icon={
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                }
              />

            </div>
          </SpotlightCard>

          {/* Trust Indicator */}
          <div className="mt-10 flex items-center justify-center gap-2 text-xs text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>安全的企業級身份驗證</span>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 left-0 right-0 text-center">
          <p className="text-[10px] text-zinc-400">
            繼續即表示您同意我們的 <a href="#" className="underline hover:text-zinc-900 dark:hover:text-zinc-100">條款</a> 以及 <a href="#" className="underline hover:text-zinc-900 dark:hover:text-zinc-100">隱私政策</a>。
          </p>
        </div>
      </div>

      {/* --- Right Side: Visual Area (PixelBlast) --- */}
      <div className="hidden lg:block relative bg-black h-full w-full overflow-hidden">
        {/* PixelBlast Effect */}
        <div className="absolute inset-0 z-0">
          <PixelBlast
            variant="circle"
            pixelSize={12}
            color="#B19EEF"
            patternScale={3}
            patternDensity={1.2}
            pixelSizeJitter={0.5}
            enableRipples={true}
            rippleSpeed={0.4}
            rippleThickness={0.12}
            rippleIntensityScale={1.5}
            speed={2}
            edgeFade={0.25}
            transparent={true}
          />
        </div>

        {/* Poster Overlay Content */}
        <div className="absolute inset-0 z-10 flex flex-col justify-between p-16 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-black/20">
          <div className="flex justify-end">
            <div className="h-12 w-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center backdrop-blur-md">
              <ArrowRight className="h-5 w-5 text-white -rotate-45" />
            </div>
          </div>

          <div className="max-w-lg space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs font-medium text-white/80 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B19EEF] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#B19EEF]"></span>
              </span>
              multi-ai-chatroom
            </div>
            <h2 className="text-5xl font-bold tracking-tighter text-white leading-[1.1]">
              無限制 AI聊天室 <br />
              <span className="text-zinc-500">Powered by UnieAI</span>
            </h2>
            <p className="text-lg text-zinc-400 font-light leading-relaxed max-w-md">
              遊走道德底線，享受極致刺激，探索各式擦邊，全網唯一最糟糕的 AI 聊天平台。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface LoginPageProp {
  redirectUrl: string;
}

export const LoginPage = ({ redirectUrl }: LoginPageProp) => {
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      <Login redirectUrl={redirectUrl} />
    </GoogleOAuthProvider>
  )
}