import test from 'node:test';
import assert from 'node:assert/strict';
import { authSettings } from '../lib/auth-config.ts';
test('OAuth buttons require secret, origin, and matching provider credentials', () => {
  const e = {
    AUTH_URL: 'https://app.example',
    AUTH_SECRET: 'x'.repeat(32),
    GOOGLE_CLIENT_ID: 'test',
    GOOGLE_CLIENT_SECRET: 'test',
  };
  assert.equal(authSettings(e).providers[0].enabled, true);
  assert.equal(authSettings(e).providers[1].enabled, false);
  assert.equal(authSettings({ ...e, AUTH_SECRET: '' }).ready, false);
});
test('auth rejects insecure remote origins, userinfo and non-root URLs', () => {
  for (const AUTH_URL of [
    'http://app.example',
    'https://user:pass@app.example',
    'https://app.example/other',
    'https://app.example/?x=1',
  ])
    assert.equal(
      authSettings({ AUTH_URL, AUTH_SECRET: 'x'.repeat(32) }).ready,
      false,
    );
  assert.equal(
    authSettings({
      AUTH_URL: 'http://localhost:3000',
      AUTH_SECRET: 'x'.repeat(32),
    }).ready,
    true,
  );
});
