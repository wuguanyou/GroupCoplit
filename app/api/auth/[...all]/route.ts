import { createAuth, publicAuthSettings } from '../../../../lib/auth';
async function handle(request: Request) {
  if (!publicAuthSettings().ready)
    return Response.json(
      { error: '登入服務尚未完成設定，請稍後再試。' },
      { status: 503 },
    );
  try {
    return await createAuth().handler(request);
  } catch {
    return Response.json(
      { error: '登入暫時無法完成，請重新嘗試。' },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
