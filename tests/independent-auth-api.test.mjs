import test from 'node:test';
import assert from 'node:assert/strict';
import { testSession } from './local-session.mjs';
const base = 'http://localhost:3000';
test('forwarded ChatGPT identity no longer authenticates anyone', async () => {
  const r = await fetch(base + '/api/project', {
    headers: {
      'oai-authenticated-user-id': 'pretend',
      'oai-authenticated-user-email': 'pretend@example.test',
    },
  });
  assert.equal(r.status, 401);
});
test('real server-side test session signs out and cannot be replayed', async () => {
  const Cookie = testSession(crypto.randomUUID());
  let r = await fetch(base + '/api/workspace', { headers: { Cookie } });
  assert.ok((await r.json()).user);
  r = await fetch(base + '/api/auth/sign-out', {
    method: 'POST',
    headers: { Cookie, Origin: base, 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(r.status, 200);
  r = await fetch(base + '/api/workspace', { headers: { Cookie } });
  assert.equal((await r.json()).user, null);
});
test('social sign-in rejects untrusted origin and callbacks without OAuth state', async () => {
  const r = await fetch(base + '/api/auth/sign-in/social', {
    method: 'POST',
    headers: {
      Origin: 'https://untrusted.example',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
  });
  assert.ok([400, 403].includes(r.status));
  const callback = await fetch(
    base + '/api/auth/callback/google?code=synthetic',
    { redirect: 'manual' },
  );
  assert.ok(callback.status >= 300);
});
