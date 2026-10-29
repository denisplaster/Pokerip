import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import GitHub from "next-auth/providers/github";
import { loginSchema } from "@/lib/validators";
import { prisma } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";
import { findUserForLogin, linkOAuthAccount, verifyPassword } from "@/server/services/users";

const providers: Provider[] = [
  Credentials({
    credentials: {
      identifier: { label: "Email or username" },
      password: { label: "Password", type: "password" },
    },
    async authorize(raw) {
      const parsed = loginSchema.safeParse(raw);
      if (!parsed.success) return null;
      const { identifier, password } = parsed.data;
      try {
        rateLimit(`login:${identifier.toLowerCase()}`, 8, 10 * 60_000);
      } catch {
        return null;
      }
      const user = await findUserForLogin(identifier);
      const ok = await verifyPassword(password, user?.passwordHash);
      if (!user || !ok || user.isBot || user.suspendedAt) return null;
      return { id: user.id, name: user.username, email: user.email, image: user.image };
    },
  }),
];

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) providers.push(GitHub);
if (process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET) providers.push(Discord);

export const oauthProviders = providers
  .map((p) => (typeof p === "function" ? p() : p))
  .filter((p) => p.type === "oauth" || p.type === "oidc")
  .map((p) => ({ id: p.id, name: p.name }));

export const authConfig = {
  providers,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  trustHost: process.env.AUTH_TRUST_HOST === "true" || process.env.NODE_ENV !== "production",
  callbacks: {
    async jwt({ token, user, account, profile, trigger }) {
      if (account && user) {
        if (account.provider === "credentials") {
          token.uid = user.id;
        } else {
          const linked = await linkOAuthAccount({
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            type: account.type,
            email: user.email,
            name: user.name,
            image: user.image,
            login: (profile as { login?: string; username?: string } | undefined)?.login ??
              (profile as { username?: string } | undefined)?.username ??
              null,
          });
          token.uid = linked.id;
        }
      }
      if (token.uid && (account || trigger === "update" || !token.username)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.uid as string },
          select: { username: true, role: true, avatar: true, image: true, suspendedAt: true },
        });
        if (!dbUser || dbUser.suspendedAt) return null;
        token.username = dbUser.username;
        token.role = dbUser.role;
        token.avatar = dbUser.avatar;
        token.picture = dbUser.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) {
        session.user.id = token.uid as string;
        session.user.username = (token.username as string) ?? "";
        session.user.role = (token.role as "USER" | "ADMIN") ?? "USER";
        session.user.avatar = (token.avatar as string) ?? "pikachu";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth(authConfig);
