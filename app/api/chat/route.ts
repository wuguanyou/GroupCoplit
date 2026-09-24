import { env } from 'cloudflare:workers';
import { access, apiError, sameOrigin, AccessError } from '../../../lib/access';
import { parseMessage, chatCursor } from '../../../lib/chat';
const fields = 'id, user_id AS userId, name, body, created_at AS createdAt';
export async function GET(request: Request) {
  try {
    const { projectId } = await access();
    let before: number | null, after: number | null;
    try {
      const params = new URL(request.url).searchParams;
      before = chatCursor(params.get('before')); after = chatCursor(params.get('after'));
      if(before !== null && after !== null) throw Error('請選擇單一分頁方向');
    }
    catch (e) { throw new AccessError((e as Error).message, 400); }
    const cursor = before ?? after;
    const result = await env.DB.prepare(`SELECT ${fields} FROM chat_messages WHERE project_id = ? ${cursor === null ? '' : before !== null ? 'AND id < ?' : 'AND id > ?'} ORDER BY id ${after !== null ? 'ASC' : 'DESC'} LIMIT 51`)
      .bind(...(cursor === null ? [projectId] : [projectId, cursor])).all();
    const messages = result.results.slice(0, 50);
    return Response.json({ messages: after !== null ? messages : messages.reverse(), hasMore: result.results.length > 50 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return apiError(e); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user, projectId } = await access();
    let parsed;
    try {
      const raw = await request.text();
      if (raw.length > 16000) throw new Error('訊息過長');
      parsed = parseMessage(JSON.parse(raw));
    } catch (e) { throw new AccessError(e instanceof SyntaxError ? '訊息格式錯誤' : (e as Error).message, 400); }
    // Client-generated nonce makes retries safe after a lost response.
    await env.DB.prepare('INSERT INTO chat_messages (project_id, user_id, name, body, nonce, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(project_id, user_id, nonce) DO NOTHING')
      .bind(projectId, user.userId, user.displayName, parsed.body, parsed.nonce, new Date().toISOString()).run();
    const message = await env.DB.prepare(`SELECT ${fields} FROM chat_messages WHERE project_id = ? AND user_id = ? AND nonce = ?`).bind(projectId, user.userId, parsed.nonce).first();
    return Response.json({ message }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return apiError(e); }
}
