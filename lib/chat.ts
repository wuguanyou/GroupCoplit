export type ChatMessage = { id: number; userId: string; name: string; body: string; createdAt: string };
export function parseMessage(input: unknown) {
  const value = input as Record<string, unknown> | null;
  if (!value || typeof value.body !== 'string' || !value.body.trim() || value.body.length > 2000)
    throw new Error('訊息須為 1～2000 字');
  if (typeof value.nonce !== 'string' || !/^[a-f0-9-]{36}$/i.test(value.nonce))
    throw new Error('訊息識別碼無效，請重新整理');
  return { body: value.body.trim(), nonce: value.nonce };
}
export function chatCursor(raw: string | null) {
  if (raw === null) return null;
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n) || n < 1) throw new Error('訊息分頁無效');
  return n;
}
