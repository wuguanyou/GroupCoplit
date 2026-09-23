import { analyze, schedule, log, type Project } from './project.ts';

export function inspectProject(source: Project, at: string): Project | null {
  if (source.demo || !source.tasks.some((t) => t.status !== 'done')) return null;
  if (source.backgroundCheckedAt?.slice(0, 13) === at.slice(0, 13)) return null;
  const p = structuredClone(source);
  const result = analyze(p, at.slice(0, 10));
  const signature = JSON.stringify(result.risks.map((r) => [r.title, r.detail]));
  if (signature !== p.backgroundRiskSignature) {
    if (result.risks.length) log(p, '背景巡檢：發現專案風險', result.risks.map((r) => `${r.title}：${r.detail}`).join('\n'), 'risk');
    else if (p.backgroundRiskSignature) log(p, '背景巡檢：風險已解除', '目前沒有偵測到逾期、不可排程或人力受限風險。', 'risk');
  }
  if (p.auto && result.risks.length) {
    const changes = schedule(p, true, at.slice(0, 10)).changes;
    for (const c of changes) {
      log(p, '背景巡檢：調整任務分工', `${p.tasks.find((t) => t.id === c.taskId)?.title} → ${p.members.find((m) => m.id === c.to)?.name}。${c.reason} 原截止日與成果歸屬保留。`, 'plan');
    }
  }
  p.backgroundRiskSignature = signature;
  p.backgroundCheckedAt = at;
  p.lastCheck = at;
  return p;
}

export async function runProjectMonitor(db: D1Database, at: string) {
  let cursor = '';
  let checked = 0, conflicted = 0, failed = 0;
  for (;;) {
    const page = await db.prepare('SELECT id, data, revision FROM projects WHERE id > ? ORDER BY id LIMIT 50').bind(cursor).all<{id: string; data: string; revision: number}>();
    if (!page.results.length) break;
    for (const row of page.results) {
      cursor = row.id;
      try {
        const p = inspectProject(JSON.parse(row.data), at);
        if (!p) continue;
        const saved = await db.prepare('UPDATE projects SET data = ?, revision = revision + 1 WHERE id = ? AND revision = ?').bind(JSON.stringify(p), row.id, row.revision).run();
        if (saved.meta.changes) checked++; else conflicted++;
      } catch { failed++; }
    }
  }
  console.log(JSON.stringify({ monitor: { checked, conflicted, failed } }));
  if (failed) throw new Error(`Background project inspection failed for ${failed} projects`);
}
