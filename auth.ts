// app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens, userPhotos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

import { type DefaultSession } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

// ────────────────────────────────────────────────
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      name: string | null;
      email: string;
      role?: string;
    } & DefaultSession["user"];   // 保留 DefaultSession 的 expires 等，但 user 自己定義
  }

  interface User {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    name?: string | null;
    email?: string;
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

      const providerImage =
        (typeof user.image === "string" && user.image.trim()) ||
        (typeof (profile as any)?.picture === "string" && (profile as any).picture.trim()) ||
        null;

      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, user.email),
      });

      if (!existingUser) {
        let newRole = "pending";

        const anyUserExists = await db.query.users.findFirst();
        if (!anyUserExists) {
          newRole = "super";
        } else {
          const settings = await db.query.adminSettings.findFirst();
          if (settings?.defaultUserRole) {
            newRole = settings.defaultUserRole;
          }
        }

        user.role = newRole;
      } else {
        const existingPhoto = await db.query.userPhotos.findFirst({
          where: eq(userPhotos.userId, existingUser.id),
          columns: { id: true },
        });
        if (!existingPhoto) {
          await db.insert(userPhotos).values({
            userId: existingUser.id,
            image: providerImage || existingUser.image || null,
          });
        }
      }

      return true;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email as string;
        token.role = user.role;
      }

      if (token.id) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, token.id as string),
          columns: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        });
        if (dbUser) {
          token.role = dbUser.role ?? token.role;
          token.name = dbUser.name ?? token.name;
          token.email = dbUser.email ?? token.email;
        }
      }

      if (trigger === "update" && session?.user) {
        if (session.user.role !== undefined) {
          token.role = session.user.role;
        }
        if (session.user.name !== undefined) {
          token.name = session.user.name;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name ?? null;
        session.user.email = token.email as string;
        session.user.role = token.role as string | undefined;
        delete session.user.image;
      }

      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      await db
        .insert(userPhotos)
        .values({
          userId: user.id,
          image: (typeof user.image === "string" && user.image.trim()) ? user.image : null,
        })
        .onConflictDoNothing();
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
