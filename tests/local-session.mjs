import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHmac, randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';
import { join } from 'node:path';
export function testSession(userId) {
  const dir = new URL(
    '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/',
    import.meta.url,
  );
  const file = fs
    .readdirSync(dir)
    .find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
  if (!file) throw Error('請先套用本機 D1 遷移');
  const secret = parseEnv(
    fs.readFileSync(new URL('../.env', import.meta.url), 'utf8'),
  ).AUTH_SECRET;
  if (!secret) throw Error('需要本機 AUTH_SECRET');
  const db = new DatabaseSync(new URL(file, dir));
  db.exec('PRAGMA busy_timeout = 5000');
  const now = Date.now(),
    token = randomUUID();
  db.prepare(
    'INSERT INTO auth_user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,?,?,?)',
  ).run(userId, 'Synthetic User', userId + '@example.test', 1, now, now);
  db.prepare(
    'INSERT INTO auth_session (id,user_id,token,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)',
  ).run(randomUUID(), userId, token, now + 3600000, now, now);
  db.close();
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  return (
    'grouppilot.session_token=' + encodeURIComponent(token + '.' + signature)
  );
}
