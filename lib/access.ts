import { cookies, headers } from 'next/headers';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
export class AccessError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
  }
}
export async function requireUser() {
  const user = await getChatGPTUser();
  if (!user) throw new AccessError('請先登入', 401);
  return user;
}
export async function access(explicitId?: string | null) {
  const user = await requireUser();
  const projectId =
    explicitId ||
    (await headers()).get('x-project-id') ||
    (await cookies()).get('gp_project')?.value;
  if (!projectId) throw new AccessError('請先建立或選擇專案', 404);
  const row = await env.DB.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
  )
    .bind(projectId, user.userId)
    .first<{ role: string }>();
  if (!row) throw new AccessError('你不是這個專案的成員');
  return { user, projectId, role: row.role };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    throw new AccessError('來源不符');
}
export function apiError(e: unknown) {
  return Response.json(
    {
      error:
        e instanceof AccessError ? e.message : '操作未完成，請重新載入後再試。',
    },
    { status: e instanceof AccessError ? e.status : 503 },
  );
}
export function owner(role: string) {
  if (role !== 'owner') throw new AccessError('此操作需由專案建立者執行');
}
