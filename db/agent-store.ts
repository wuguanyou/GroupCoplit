import { access } from '../lib/access';
import { env } from 'cloudflare:workers';
import type { AgentKind, AgentResult } from '../lib/agent-contracts';
import type { AgentInput } from '../lib/agent-tools';
import { AgentError } from '../lib/ai-provider';
export type Run = {
  id: string;
  kind: AgentKind;
  baseRevision: number;
  status:
    | 'running'
    | 'proposed'
    | 'applied'
    | 'failed'
    | 'stale'
    | 'clarification'
    | 'complete';
  input: AgentInput;
  result: AgentResult | null;
  message: string;
  model: string;
  createdAt: string;
  updatedAt: string;
};
type Row = {
  id: string;
  kind: AgentKind;
  base_revision: number;
  status: Run['status'];
  input: string;
  result: string | null;
  message: string;
  model: string;
  created_at: string;
  updated_at: string;
};
const decode = (r: Row): Run => ({
  id: r.id,
  kind: r.kind,
  baseRevision: r.base_revision,
  status: r.status,
  input: JSON.parse(r.input),
  result: r.result ? JSON.parse(r.result) : null,
  message: r.message,
  model: r.model,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
export async function getRun(id: string) {
  const r = await env.DB.prepare(
    'SELECT * FROM agent_runs WHERE id = ? AND project_id = ?',
  )
    .bind(id, (await access()).projectId)
    .first<Row>();
  return r ? decode(r) : null;
}
export async function listRuns() {
  const r = await env.DB.prepare(
    'SELECT * FROM agent_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT 20',
  )
    .bind((await access()).projectId)
    .all<Row>();
  return r.results.map(decode);
}
export async function reserveRun(run: Run, limit: number) {
  const start = run.createdAt.slice(0, 10) + 'T00:00:00.000Z';
  const cutoff = new Date(Date.now() - 90000).toISOString();
  const r =
    await env.DB.prepare(`INSERT OR IGNORE INTO agent_runs (id, project_id, kind, base_revision, status, input, result, message, model, created_at, updated_at)
 SELECT ?, ?, ?, ?, 'running', ?, NULL, '', ?, ?, ?
 WHERE (SELECT COUNT(*) FROM agent_runs WHERE created_at >= ?) < ?
 AND NOT EXISTS (SELECT 1 FROM agent_runs WHERE status = 'running' AND created_at > ?)`)
      .bind(
        run.id,
        (await access()).projectId,
        run.kind,
        run.baseRevision,
        JSON.stringify(run.input),
        run.model,
        run.createdAt,
        run.updatedAt,
        start,
        limit,
        cutoff,
      )
      .run();
  if (!r.meta.changes)
    throw new AgentError(
      '已有 AI 工作執行中、請求重複或今日呼叫額度已用完，請稍後再試。',
      429,
    );
}
export async function finishRun(
  id: string,
  status: Run['status'],
  result: AgentResult | null,
  message = '',
) {
  await env.DB.prepare(
    'UPDATE agent_runs SET status = ?, result = ?, message = ?, updated_at = ? WHERE id = ? AND project_id = ?',
  )
    .bind(
      status,
      result ? JSON.stringify(result) : null,
      message,
      new Date().toISOString(),
      id,
      (await access()).projectId,
    )
    .run();
  return (await getRun(id))!;
}
