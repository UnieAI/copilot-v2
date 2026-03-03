// auth.ts 或 app/api/auth/[...nextauth]/route.ts
import NextAuth, { DefaultSession, type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens, adminSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ────────────────────────────────────────────────
// 型別擴展（放在同一個檔案或 src/types/next-auth.d.ts 都可以）
declare module "next-auth" {
  interface User {
    role?: string;
  }

  interface Session {
    user: {
      id: string;
      role?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}
// ────────────────────────────────────────────────

export const authConfig = {
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      // 如果需要綁定特定 Tenant，請使用 issuer（推薦做法）
      // issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
      
      // 如果是多租戶或 common 端點，就完全不設 issuer
      // tenantId 已於 v5 多數版本移除，不建議使用
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return true;

      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, user.email),
      });

      // 新使用者才決定角色
      if (!existingUser) {
        let newRole = "pending";

        // 第一個使用者 → super admin
        const anyUserExists = await db.query.users.findFirst();
        if (!anyUserExists) {
          newRole = "super";
        } else {
          const settings = await db.query.adminSettings.findFirst();
          if (settings?.defaultUserRole) {
            newRole = settings.defaultUserRole;
          }
        }

        // 暫存 role 到 user 物件，之後 jwt callback 會拿到
        user.role = newRole;
      }

      return true;
    },

    async jwt({ token, user, trigger, session }) {
      // 初次登入：把 user 裡的資料帶進 token
      if (user) {
        token.id = user.id;
        if (user.role) {
          token.role = user.role;
        }
      }

      // 每次 JWT 更新時，從資料庫重新抓取最新 role（反映管理員即時變更）
      if (token.id) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, token.id as string),
        });
        if (dbUser) {
          token.role = dbUser.role ?? token.role;
          // 如果你也想保持 name 最新，也可以這裡更新：
          // token.name = dbUser.name ?? token.name;
        }
      }

      // 處理 useSession().update() 觸發的更新
      if (trigger === "update" && session?.user) {
        token = { ...token, ...session.user };

        // 可選：同步最新 name
        if (token.id) {
          const freshUser = await db.query.users.findFirst({
            where: eq(users.id, token.id as string),
          });
          if (freshUser?.name) {
            token.name = freshUser.name;
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token?.id) {
        session.user.id = token.id as string;
        session.user.role = token.role as string | undefined;
        if (token.name) {
          session.user.name = token.name as string | null;
        }
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);