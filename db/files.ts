import { env } from 'cloudflare:workers';
import { AccessError } from '../lib/access';
export type StoredFile = {
  id: string;
  project_id: string;
  uploader: string;
  name: string;
  size: number;
  category: string;
  task_id: string;
  created_at: string;
};
export async function listFiles(projectId: string) {
  return (
    await env.DB.prepare(
      'SELECT * FROM project_files WHERE project_id = ? ORDER BY created_at DESC',
    )
      .bind(projectId)
      .all<StoredFile>()
  ).results;
}
export async function findFile(projectId: string, id: string) {
  return env.DB.prepare(
    'SELECT * FROM project_files WHERE project_id = ? AND id = ?',
  )
    .bind(projectId, id)
    .first<StoredFile>();
}
export async function storeFile(row: StoredFile, bytes: ArrayBuffer) {
  const key = row.project_id + '/' + row.id;
  await env.BUCKET.put(key, bytes, {
    httpMetadata: { contentType: 'application/octet-stream' },
  });
  try {
    await env.DB.prepare(
      'INSERT INTO project_files (id,project_id,uploader,name,size,category,task_id,created_at) VALUES (?,?,?,?,?,?,?,?)',
    )
      .bind(
        row.id,
        row.project_id,
        row.uploader,
        row.name,
        row.size,
        row.category,
        row.task_id,
        row.created_at,
      )
      .run();
  } catch (e) {
    await env.BUCKET.delete(key);
    throw e;
  }
}
export async function fileBody(row: StoredFile) {
  return env.BUCKET.get(row.project_id + '/' + row.id);
}
export async function validateAttachments(
  value: unknown,
  taskId: string,
  a: { projectId: string; user: { userId: string } },
) {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > 10 ||
    value.some((x) => typeof x !== 'string')
  )
    throw new AccessError('附件清單無效', 400);
  const ids = [...new Set(value)] as string[];
  for (const id of ids) {
    const f = await findFile(a.projectId, id);
    if (
      !f ||
      f.uploader !== a.user.userId ||
      f.category !== 'submission' ||
      f.task_id !== taskId
    )
      throw new AccessError('附件不屬於此任務或提交者', 400);
  }
  return ids;
}
