// auth.config.ts
import type { NextAuthConfig } from "next-auth";
import { type DefaultSession } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

import { getUserByEmail } from "@/lib/db/queries";

// 型別擴展 - 保持與你原本的一致
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      username: string;
      // userimage: string;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string| null;
    username: string;
    // userimage: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    username: string;
    // userimage: string;
  }
}

export const authConfig = {
  trustHost: true,

  providers: [
    Credentials({
      id: "credentials",
      name: "Email & Password",

      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "your@email.com",
        },
        password: {
          label: "密碼",
          type: "password",
        },
      },

      async authorize(credentials) {
        try {
          // 基本欄位檢查
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const email = credentials.email as string;
          const password = credentials.password as string;

          // 從資料庫取得使用者
          const user = await getUserByEmail(email);

          // 使用者不存在
          if (!user) {
            return null;
          }

          // 沒有設定密碼（可能是第三方登入帳號）
          if (!user.password) {
            return null; // 或可拋出錯誤訊息：請使用原註冊方式登入
          }

          // 密碼比對
          const passwordsMatch = await compare(password, user.password);

          if (!passwordsMatch) {
            return null;
          }

          // 驗證成功，回傳必要資訊
          return {
            id: user.id,
            email: user.email,
            username: user.username || "",
            // userimage: user.userimage || "",
          };
        } catch (error) {
          console.error("Authorize error:", error);
          return null;
        }
      },
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login",
    // newUser: '/welcome',     // 可選：註冊後導向頁面
  },

  callbacks: {
    async jwt({ token, user }) {
      // 第一次登入時，user 會有值
      if (user) {
        token.id = user.id!;
        token.email = user.email!;
        token.username = user.username;
        // token.userimage = user.userimage;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.username = token.username as string;
        // session.user.userimage = token.userimage as string;
      }
      return session;
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  debug: process.env.NODE_ENV === "development",

} satisfies NextAuthConfig;

export default authConfig;