import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { authSettings } from '../lib/auth-config.ts';
const config = JSON.parse(
  fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
);
const envPath = new URL('../.env.production.local', import.meta.url);
const env = fs.existsSync(envPath)
  ? parseEnv(fs.readFileSync(envPath, 'utf8'))
  : {};
const c = authSettings(env),
  problems = [];
if (
  config.d1_databases?.[0]?.database_id ===
  '00000000-0000-4000-8000-000000000000'
)
  problems.push('請在 wrangler.jsonc 填入你自己帳號建立的 D1 database_id');
if (!c.ready || c.local)
  problems.push(
    '請在 .env.production.local 填入正式 HTTPS AUTH_URL 與至少 32 字元的 AUTH_SECRET',
  );
for (const p of c.providers)
  if (!p.enabled)
    problems.push('尚未設定 ' + p.name + ' OAuth Client ID / Secret');
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    '本機部署設定檢查通過；仍需確認 Cloudflare 資源、正式 Secrets 與 OAuth 回呼設定。',
  );
}
