'use client';
import { useEffect, useState } from 'react';
import { GitBranch, ArrowRight } from 'lucide-react';
type Provider = { id: 'google' | 'github'; name: string; enabled: boolean };
export function SocialLogin() {
  const [providers, setProviders] = useState<Provider[]>([
      { id: 'google', name: 'Google', enabled: false },
      { id: 'github', name: 'GitHub', enabled: false },
    ]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/auth-options')
      .then(async (r) => {
        if (!r.ok) throw Error('暫時無法取得登入方式');
        const j = (await r.json()) as { providers: Provider[] };
        setProviders(j.providers);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    if (new URLSearchParams(location.search).has('error'))
      setError('登入未完成，請重新選擇登入方式。');
  }, []);
  async function signIn(provider: string) {
    setBusy(provider);
    setError('');
    try {
      const r = await fetch('/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          callbackURL: '/',
          errorCallbackURL: '/?error=signin',
        }),
      });
      const j = (await r.json()) as { url?: string };
      if (!r.ok || !j.url) throw Error('登入暫時無法完成，請稍後再試。');
      window.location.assign(j.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy('');
    }
  }
  return (
    <div className="social-login">
      <p>選擇你習慣的帳號，開始與團隊協作。</p>
      {providers.map((p) => (
        <button
          key={p.id}
          className={'btn social-button ' + p.id}
          disabled={loading || !p.enabled || !!busy}
          onClick={() => signIn(p.id)}
        >
          {p.id === 'github' ? (
            <GitBranch size={21} />
          ) : (
            <span className="google-letter" aria-hidden="true">
              G
            </span>
          )}
          <span>
            {busy === p.id ? '正在前往登入…' : '使用 ' + p.name + ' 繼續'}
          </span>
          <ArrowRight size={17} />
        </button>
      ))}
      {!loading && providers.every((p) => !p.enabled) && (
        <p className="auth-unavailable" role="status">
          登入服務尚未開放，請稍後再來。
        </p>
      )}
      {error && (
        <p className="file-error" role="alert">
          {error}
        </p>
      )}
      <small>只有加入專案的成員，才能查看團隊資料與檔案。</small>
    </div>
  );
}
export function SignOut() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <span>
      <button
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const r = await fetch('/api/auth/sign-out', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
            });
            if (!r.ok) throw Error();
            window.location.assign('/');
          } catch {
            setError('登出失敗，請再試一次');
            setBusy(false);
          }
        }}
      >
        {busy ? '登出中…' : '登出'}
      </button>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
