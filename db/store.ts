import { env } from 'cloudflare:workers';
import { access } from '../lib/access';
import type { Project } from '../lib/project';
export async function readProject() {
  const { projectId } = await access();
  const row = await env.DB.prepare(
    'SELECT data, revision FROM projects WHERE id = ?',
  )
    .bind(projectId)
    .first<{ data: string; revision: number }>();
  if (!row) throw Error('找不到專案');
  return { project: JSON.parse(row.data) as Project, revision: row.revision };
}
export async function saveProject(project: Project, revision: number) {
  const { projectId } = await access();
  const r = await env.DB.prepare(
    'UPDATE projects SET data = ?, revision = revision + 1 WHERE id = ? AND revision = ?',
  )
    .bind(JSON.stringify(project), projectId, revision)
    .run();
  if (!r.meta.changes) throw Error('資料已被其他操作更新，請重新載入後再試');
}
