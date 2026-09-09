import { env } from 'cloudflare:workers';
import { seed, type Project } from '../lib/project';
export async function readProject() {
  const row = await env.DB.prepare(
    'SELECT data, revision FROM projects WHERE id = ?',
  )
    .bind('main')
    .first<{ data: string; revision: number }>();
  if (row)
    return { project: JSON.parse(row.data) as Project, revision: row.revision };
  const initial = seed();
  await env.DB.prepare(
    'INSERT OR IGNORE INTO projects (id, data, revision) VALUES (?, ?, 0)',
  )
    .bind('main', JSON.stringify(initial))
    .run();
  const created = await env.DB.prepare(
    'SELECT data, revision FROM projects WHERE id = ?',
  )
    .bind('main')
    .first<{ data: string; revision: number }>();
  if (!created) throw Error('無法初始化專案');
  return {
    project: JSON.parse(created.data) as Project,
    revision: created.revision,
  };
}
export async function saveProject(project: Project, revision: number) {
  const r = await env.DB.prepare(
    'UPDATE projects SET data = ?, revision = revision + 1 WHERE id = ? AND revision = ?',
  )
    .bind(JSON.stringify(project), 'main', revision)
    .run();
  if (!r.meta.changes) throw Error('資料已被其他操作更新，請重新載入後再試');
}
