import { access, apiError, AccessError, sameOrigin } from '../../../lib/access';
import { readProject } from '../../../db/store';
import { listFiles, findFile, fileBody, storeFile } from '../../../db/files';
const MAX = 10 * 1024 * 1024;
export async function GET(request: Request) {
  try {
    const a = await access(new URL(request.url).searchParams.get('project'));
    const id = new URL(request.url).searchParams.get('id');
    if (!id)
      return Response.json(
        { files: await listFiles(a.projectId) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    const f = await findFile(a.projectId, id);
    if (!f) throw new AccessError('找不到檔案', 404);
    const obj = await fileBody(f);
    if (!obj) throw new AccessError('檔案暫時無法讀取', 503);
    return new Response(obj.body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(f.size),
        'Content-Disposition':
          "attachment; filename=download; filename*=UTF-8''" +
          encodeURIComponent(f.name).replace(/'/g, '%27'),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const a = await access();
    // Bound multipart bytes even when Content-Length is absent.
    const reader = request.body?.getReader();
    if (!reader) throw new AccessError('請選擇檔案', 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX + 65536) {
        await reader.cancel();
        throw new AccessError('每個檔案上限 10 MB', 413);
      }
      chunks.push(value);
    }
    const form = await new Response(new Blob(chunks as BlobPart[]), {
      headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
    }).formData();
    const file = form.get('file');
    if (!(file instanceof File) || !file.size || file.size > MAX)
      throw new AccessError('請選擇 1 byte 至 10 MB 的檔案', 400);
    const name = file.name.replace(/[\/\\\x00-\x1f]/g, '_').slice(0, 180);
    if (!/\.(pdf|docx|pptx|xlsx|txt|md|csv|png|jpe?g|zip)$/i.test(name))
      throw new AccessError('支援 PDF、Office、文字、圖片及 ZIP 檔案', 400);
    const category =
      form.get('category') === 'submission' ? 'submission' : 'reference';
    const taskId =
      category === 'submission' ? String(form.get('taskId') ?? '') : '';
    const { project } = await readProject();
    if (
      category === 'submission' &&
      !project.tasks.some((t) => t.id === taskId)
    )
      throw new AccessError('請選擇有效任務', 400);
    const files = await listFiles(a.projectId);
    if (files.length >= 200)
      throw new AccessError('每個專案最多 200 個檔案', 400);
    const row = {
      id: crypto.randomUUID(),
      project_id: a.projectId,
      uploader: a.user.userId,
      name,
      size: file.size,
      category,
      task_id: taskId,
      created_at: new Date().toISOString(),
    };
    await storeFile(row, await file.arrayBuffer());
    return Response.json({ file: row });
  } catch (e) {
    return apiError(e);
  }
}
