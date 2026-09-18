import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';
import * as schema from '../db/auth-schema';
import { authSettings, type AuthEnv } from './auth-config';
export function publicAuthSettings() {
  return authSettings(env as unknown as AuthEnv);
}
export function createAuth() {
  const e = env as unknown as AuthEnv,
    c = authSettings(e);
  if (!c.ready) throw Error('登入服務尚未完成設定');
  return betterAuth({
    appName: 'GroupPilot',
    baseURL: c.baseURL,
    basePath: '/api/auth',
    secret: e.AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DB), {
      provider: 'sqlite',
      schema,
      transaction: false,
    }),
    socialProviders: {
      ...(c.providers[0].enabled
        ? {
            google: {
              clientId: e.GOOGLE_CLIENT_ID!,
              clientSecret: e.GOOGLE_CLIENT_SECRET!,
            },
          }
        : {}),
      ...(c.providers[1].enabled
        ? {
            github: {
              clientId: e.GITHUB_CLIENT_ID!,
              clientSecret: e.GITHUB_CLIENT_SECRET!,
            },
          }
        : {}),
    },
    trustedOrigins: [c.baseURL],
    account: { accountLinking: { enabled: false }, encryptOAuthTokens: true },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 60 },
    advanced: {
      cookiePrefix: 'grouppilot',
      useSecureCookies: !c.local,
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
  });
}
export async function getAppUser() {
  if (!publicAuthSettings().ready) return null;
  const session = await createAuth().api.getSession({
    headers: await headers(),
  });
  if (!session) return null;
  return {
    userId: session.user.id,
    displayName: session.user.name || session.user.email,
    email: session.user.email,
  };
}
