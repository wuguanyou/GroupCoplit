'use client';
import { useState } from 'react';
import { Bot, Check, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';
import type { Project } from '../lib/project';
import type { AgentKind, AgentResult } from '../lib/agent-contracts';
type Run = {
  id: string;
  kind: AgentKind;
  status: string;
  result: AgentResult | null;
  message: string;
  model: string;
  createdAt: string;
  input: { note: string; taskId?: string };
};
type Status = {
  configured: boolean;
  missing: string[];
  model: string;
  protocol: string;
  dailyLimit: number;
};
const labels: Record<AgentKind, string> = {
  plan: '需求拆解',
  report: '理解進度回報',
  rebalance: '重新分工',
  analysis: '風險與貢獻分析',
};
const states: Record<string, string> = {
  running: '分析中',
  proposed: '待套用',
  applied: '已執行',
  failed: '未執行',
  stale: '資料已變更',
  clarification: '需要補充',
  complete: '分析完成',
};
export function AgentPanel({
  project,
  revision,
  status,
  onRefresh,
}: {
  project: Project;
  revision: number;
  status: Status;
  onRefresh: () => Promise<unknown>;
}) {
  const [kind, setKind] = useState<AgentKind>('plan');
  const [note, setNote] = useState('');
  const [taskId, setTaskId] = useState(
    project.tasks.find((t) => t.status === 'doing' || t.status === 'todo')
      ?.id ?? '',
  );
  const [token, setToken] = useState('');
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<Run | null>(null);
  async function refreshRuns() {
    const r = await fetch('/api/agent', {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
    });
    const j = (await r.json()) as { runs: Run[]; error?: string };
    if (!r.ok) throw Error(j.error ?? '無法讀取工作紀錄');
    setRuns(j.runs);
    return j.runs;
  }
  async function act(action: 'run' | 'apply') {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(
          action === 'run'
            ? {
                action,
                kind,
                note,
                taskId,
                revision,
                requestId: crypto.randomUUID(),
                autoApply: kind !== 'plan' && kind !== 'analysis' && auto,
              }
            : { action, runId: selected?.id },
        ),
      });
      const j = (await response.json()) as { run: Run; error?: string };
      if (!response.ok) throw Error(j.error ?? '操作失敗');
      setSelected(j.run);
      await onRefresh();
      await refreshRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失敗');
      await onRefresh().catch(() => {});
      await refreshRuns().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  const result = selected?.result;
  return (
    <div className="agent-workspace">
      <section className="notice">
        <Bot size={24} />
        <div>
          <strong>
            {status.configured
              ? '模型設定已就緒，等待實際連線驗證'
              : 'AI 接口已建置，等待模型資源'}
          </strong>
          <p>
            {status.configured
              ? `${status.model} · 每日最多 ${status.dailyLimit} 次模型請求；失敗請求也計入上限。`
              : `尚需：${status.missing.join('、')}。未設定時不會產生模擬 AI 結果。`}
          </p>
        </div>
      </section>
      <div className="columns">
        <section className="panel agent-form">
          <div className="section-title">
            <h2>交給代理組長</h2>
            <span className="badge neutral">模型 → 驗證 → 工具執行</span>
          </div>
          <label>
            工作類型
            <select
              value={kind}
              disabled={busy}
              onChange={(e) => {
                setKind(e.target.value as AgentKind);
                setSelected(null);
                setAuto(false);
              }}
            >
              {Object.entries(labels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {kind === 'report' && (
            <label>
              回報任務
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              >
                {project.tasks
                  .filter((t) => t.status === 'todo' || t.status === 'doing')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ·{' '}
                      {project.members.find((m) => m.id === t.owner)?.name ??
                        '未分配'}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label>
            {kind === 'plan'
              ? '新增需求或拆解重點'
              : kind === 'report'
                ? '組員的原始回報'
                : '補充說明（選填）'}
            <textarea
              value={note}
              maxLength={6000}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                kind === 'report'
                  ? '例如：資料表已列好，還需要 3 小時。我後天才能繼續。'
                  : kind === 'plan'
                    ? '例如：根據專案要求，補上尚未規劃的通知與提醒功能。'
                    : '例如：優先處理資料庫造成的依賴阻塞。'
              }
            />
          </label>
          <p>
            {kind === 'plan'
              ? 'AI 會參考已保存的作業要求與現有任務，新增任務前必須先檢視。'
              : kind === 'report'
                ? '資訊不足時會追問；不會把沒說的工時或日期自行填上。'
                : kind === 'rebalance'
                  ? '只允許轉交技能相符的未完成任務，並檢查前置依賴、工時與交接緩衝。'
                  : '依已驗收紀錄解釋貢獻，不變更貢獻點數或任務。'}
          </p>
          <label>
            AI 操作通行碼
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="由專案管理者提供；不是模型 API 金鑰"
            />
          </label>
          <small>通行碼只留在此頁記憶體，不會存入瀏覽器或傳送給模型。</small>
          {(kind === 'report' || kind === 'rebalance') && (
            <label className="agent-check">
              <input
                type="checkbox"
                checked={auto}
                disabled={!project.auto}
                onChange={(e) => setAuto(e.target.checked)}
              />
              驗證通過後依團隊授權自動執行
              {!project.auto ? '（團隊尚未開啟自動分工）' : ''}
            </label>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button
            className="btn primary"
            disabled={
              busy ||
              !status.configured ||
              token.length < 24 ||
              (kind === 'report' && (!note.trim() || !taskId))
            }
            onClick={() => void act('run')}
          >
            {busy ? <Loader2 size={16} className="spin" /> : <Bot size={16} />}
            開始{labels[kind]}
          </button>
        </section>
        <section className="panel agent-result" aria-live="polite">
          <div className="section-title">
            <h2>分析與執行結果</h2>
            {selected && (
              <span className="badge neutral">{states[selected.status]}</span>
            )}
          </div>
          {!selected ? (
            <div className="empty">
              <ShieldCheck size={36} />
              <h3>每個建議，都先經過檢查</h3>
              <p>
                模型不會直接存取資料庫。只有白名單工具能新增任務、更新回報與調整分工；成果驗收與貢獻點數仍由原有流程處理。
              </p>
            </div>
          ) : (
            <>
              <p>{selected.message}</p>
              {result && (
                <>
                  <h3>{result.summary}</h3>
                  {result.questions.length > 0 && (
                    <div className="notice">
                      <div>
                        <strong>請先補充</strong>
                        <ul>
                          {result.questions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {result.tasks?.map((t) => (
                    <article key={t.key} className="agent-task">
                      <strong>{t.title}</strong>
                      <p>
                        預估 {t.hours} 小時 · 難度 {t.difficulty}
                        <br />
                        依賴：{t.deps.join('、') || '無'}
                        <br />
                        {t.criteria}
                      </p>
                    </article>
                  ))}
                  {selected.kind === 'report' && (
                    <div className="formula-box">
                      剩餘工時：{result.remainingHours ?? '待確認'}
                      <br />
                      可工作日期：{result.availableDate ?? '待確認'}
                    </div>
                  )}
                  {result.assignments?.map((a) => (
                    <article className="agent-task" key={a.taskId}>
                      <strong>
                        {project.tasks.find((t) => t.id === a.taskId)?.title} →{' '}
                        {project.members.find((m) => m.id === a.memberId)?.name}
                      </strong>
                      <p>{a.reason}</p>
                    </article>
                  ))}
                  {(['risks', 'suggestions', 'contributionNotes'] as const).map(
                    (k) =>
                      result[k] && (
                        <div key={k}>
                          <h4>
                            {
                              {
                                risks: '風險',
                                suggestions: '建議',
                                contributionNotes: '貢獻觀察',
                              }[k]
                            }
                          </h4>
                          <ul>
                            {result[k]!.map((v, i) => (
                              <li key={i}>{v}</li>
                            ))}
                          </ul>
                        </div>
                      ),
                  )}
                </>
              )}
              {selected.status === 'proposed' && (
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => void act('apply')}
                >
                  <Check size={16} />
                  套用已驗證方案
                </button>
              )}
              {selected.status === 'applied' && (
                <p className="badge">已寫入專案，請查看任務或代理紀錄。</p>
              )}
              <p className="subtle">
                模型：{selected.model} ·{' '}
                {new Date(selected.createdAt).toLocaleString('zh-TW')}
              </p>
            </>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="section-title">
          <h2>AI 工作紀錄</h2>
          <button
            className="btn compact"
            disabled={busy || !status.configured || token.length < 24}
            onClick={() => {
              setError('');
              void refreshRuns().catch((e) => setError(e.message));
            }}
          >
            <RefreshCw size={14} />
            讀取紀錄
          </button>
        </div>
        <p>
          模型回應、驗證結果與執行狀態分開保存。專案變更後，舊方案會停止套用。
        </p>
        {runs.map((r) => (
          <button
            className="agent-run"
            key={r.id}
            onClick={() => setSelected(r)}
          >
            <span>
              {labels[r.kind]} · {r.result?.summary ?? r.message ?? '執行中'}
            </span>
            <span>{states[r.status]}</span>
          </button>
        ))}
        {!runs.length && (
          <p className="muted">輸入操作通行碼後可讀取最近 20 筆紀錄。</p>
        )}
      </section>
    </div>
  );
}
