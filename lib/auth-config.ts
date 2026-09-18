export type AuthEnv = Record<string, string | undefined>;
export function authSettings(env: AuthEnv) {
  const raw = env.AUTH_URL?.trim() ?? '';
  let url: URL | null = null;
  try {
    url = new URL(raw);
  } catch {}
  const local = !!url && ['localhost', '127.0.0.1'].includes(url.hostname);
  const valid =
    !!url &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    url.pathname === '/' &&
    (url.protocol === 'https:' || (local && url.protocol === 'http:'));
  const ready = valid && (env.AUTH_SECRET?.length ?? 0) >= 32;
  return {
    ready,
    baseURL: valid ? url!.origin : '',
    local,
    providers: [
      {
        id: 'google' as const,
        name: 'Google',
        enabled: ready && !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
      },
      {
        id: 'github' as const,
        name: 'GitHub',
        enabled: ready && !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET,
      },
    ],
  };
}
