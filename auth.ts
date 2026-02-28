import NextAuth, { type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens, adminSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
        }),
        AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
            tenantId: process.env.AZURE_AD_TENANT_ID,
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
            // Logic for first user = super, others = defaultRole
            if (user.email) {
                const existingUser = await db.query.users.findFirst({
                    where: eq(users.email, user.email),
                });

                if (!existingUser) {
                    // Check if this is the very first user
                    const allUsers = await db.query.users.findFirst();
                    let newRole = "pending";

                    if (!allUsers) {
                        newRole = "super";
                    } else {
                        const settings = await db.query.adminSettings.findFirst();
                        if (settings) {
                            newRole = settings.defaultUserRole;
                        }
                    }

                    user.role = newRole; // Temp store on user object to pass to adapter/jwt
                }
            }
            return true;
        },
        async jwt({ token, user, account, trigger, session }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role; // From adapter or signIn modification
            }

            // Every time JWT is checked, fetch fresh role from DB to reflect admin changes immediately
            if (token.id) {
                const dbUser = await db.query.users.findFirst({
                    where: eq(users.id, token.id as string)
                });
                if (dbUser) {
                    token.role = dbUser.role;
                }
            }

            if (trigger === "update" && session !== null) {
                token = { ...token, ...session }
                // Also re-fetch name from DB to ensure latest value
                if (token.id) {
                    const fresh = await db.query.users.findFirst({
                        where: eq(users.id, token.id as string)
                    })
                    if (fresh) token.name = fresh.name
                }
            }

            return token
        },
        async session({ session, token }) {
            if (session.user && token) {
                session.user.id = token.id as string
                session.user.role = token.role as string
                if (token.name) session.user.name = token.name as string
            }
            return session
        },
    },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
