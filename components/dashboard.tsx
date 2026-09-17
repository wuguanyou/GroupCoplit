'use client';
import { useCallback, useEffect, useState } from 'react';
import { useProjectFetch } from './project-context';
import {
  FileCenter,
  AttachmentPicker,
  EvidenceAttachments,
} from './file-center';
import { AgentPanel } from '../components/agent-panel';
import {
  LayoutDashboard,
  GitBranch,
  Users,
  ChartNoAxesCombined,
  Bot,
  ArrowUpRight,
  Plus,
  Clock,
  Check,
  ChevronRight,
  RefreshCw,
  FileCheck,
  AlertTriangle,
  Settings2,
  X,
  Send,
  Link as LinkIcon,
  Activity,
  Loader2,
} from 'lucide-react';
import {
  type Project,
  type Member,
  type Task,
  analyze,
  contributions,
  skillNames,
  day,
} from '../lib/project';
type Snapshot = {
  currentUserId: string;
  role: string;
  project: Project;
  revision: number;
  analysis: ReturnType<typeof analyze>;
  contributions: ReturnType<typeof contributions>;
  aiConnected: boolean;
  aiStatus: {
    configured: boolean;
    missing: string[];
    model: string;
    protocol: string;
    dailyLimit: number;
  };
};
type Form = Record<string, any>;
const tabs = [
  ['overview', '專案總覽', LayoutDashboard],
  ['agent', 'AI 代理組長', Bot],
  ['tasks', '任務與依賴', GitBranch],
  ['team', '團隊與分工', Users],
  ['contribution', '貢獻分析', ChartNoAxesCombined],
  ['files', '資料與交付', FileCheck],
  ['activity', '代理紀錄', Activity],
] as const;
const statuses = {
  todo: '待開始',
  doing: '進行中',
  review: '待驗收',
  done: '已完成',
};
function dateLabel(v: string) {
  return v.slice(5).replace('-', ' / ');
}
export default function Dashboard({
  onWorkspace,
}: {
  onWorkspace: () => void;
}) {
  const apiFetch = useProjectFetch();
  const [inviteCode, setInviteCode] = useState('');
  const [aiResult, setAIResult] = useState<any>(null);
  const [data, setData] = useState<Snapshot | null>(null),
    [view, setView] = useState('overview'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [modal, setModal] = useState(''),
    [form, setForm] = useState<Form>({}),
    [filter, setFilter] = useState('all');
  const load = useCallback(async () => {
    const r = await apiFetch('/api/project', { cache: 'no-store' });
    const j = (await r.json()) as Snapshot & { error?: string; analysis: any };
    if (!r.ok) throw Error(j.error);
    setData(j);
    return j as Snapshot;
  }, [apiFetch]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  const perform = useCallback(
    async (action: string, values: Form = {}, silent = false) => {
      if (!data) throw Error('資料尚未載入');
      if (!silent) setBusy(true);
      setError('');
      try {
        const r = await apiFetch('/api/project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...values, action, revision: data.revision }),
        });
        const j = (await r.json()) as Snapshot & {
          error?: string;
          analysis: any;
        };
        if (!r.ok) throw Error(j.error);
        const next = await load();
        if (!silent) {
          setModal('');
          setToast('已儲存，專案狀態已更新');
          setTimeout(() => setToast(''), 4000);
        }
        return next;
      } catch (e) {
        setError(e instanceof Error ? e.message : '操作失敗');
        throw e;
      } finally {
        if (!silent) setBusy(false);
      }
    },
    [data, load, apiFetch],
  );
  useEffect(() => {
    if (!data || view === 'agent') return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible')
        perform('check', {}, true).catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, [data, perform, view]);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool || !data) return;
    const controller = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'get_project_status',
          description: '讀取目前專案、任務、風險與貢獻分析，不修改資料。',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: async (input: unknown) => {
            if (
              !input ||
              typeof input !== 'object' ||
              Object.keys(input).length
            )
              throw Error('不接受參數');
            const s = await load();
            return {
              name: s.project.name,
              risks: s.analysis.risks,
              contributions: s.contributions,
            };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    Promise.resolve(
      context.registerTool(
        {
          name: 'replan_project',
          description: '依組員技能、可用時間與依賴重新分工，儲存並更新頁面。',
          inputSchema: {
            type: 'object',
            properties: { confirm: { type: 'boolean', const: true } },
            required: ['confirm'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute: async (input: any) => {
            if (
              !input ||
              input.confirm !== true ||
              Object.keys(input).length !== 1
            )
              throw Error('需 confirm: true');
            const s = await perform('replan');
            return {
              finishDate: s?.analysis.finishDate,
              risks: s?.analysis.risks,
            };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, [data, load, perform]);
  const open = (kind: string, values: Form = {}) => {
    setError('');
    setForm(values);
    setModal(kind);
  };
  const field = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));
  const run = (action: string, values: Form = {}) => {
    void perform(action, values).catch(() => {});
  };
  const p = data?.project;
  const person = (id: string) => p?.members.find((m) => m.id === id);
  const taskName = (id: string) =>
    p?.tasks.find((t) => t.id === id)?.title ?? '未指定';
  const avatar = (m?: Member) => (
    <span
      className="avatar"
      style={{ background: (m?.color ?? '#8899aa') + '20', color: m?.color }}
    >
      {m?.name.slice(0, 1) ?? '?'}
    </span>
  );
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(
      modal,
      ['report', 'evidence', 'review'].includes(modal)
        ? { ...form, memberId: data?.currentUserId }
        : form,
    );
  };
  const report = (task?: Task) => {
    const t =
      task ??
      p?.tasks.find(
        (t) => t.status !== 'done' && t.owner === data?.currentUserId,
      );
    if (t)
      open('report', {
        taskId: t.id,
        memberId: t.owner,
        note: '',
        remainingHours: t.hours,
        unavailableUntil: person(t.owner)?.unavailableUntil ?? day(),
      });
  };
  const evidence = (task?: Task) => {
    const t = task ?? p?.tasks.find((t) => t.status !== 'done') ?? p?.tasks[0];
    if (t)
      open('evidence', {
        taskId: t.id,
        memberId: data?.currentUserId,
        fileIds: [],
        kind: 'delivery',
        hours: 1,
        note: '',
        url: '',
      });
  };
  const taskForm = () =>
    open('task', {
      title: '',
      skill: 'planning',
      hours: 2,
      difficulty: 1,
      deps: [],
      criteria: '',
    });
  const completed = p?.tasks.filter((t) => t.status === 'done') ?? [];
  const total = p?.tasks.reduce((s, t) => s + t.estimate, 0) ?? 0;
  const percent = total
    ? Math.round((completed.reduce((s, t) => s + t.estimate, 0) / total) * 100)
    : 0;
  const risks = data?.analysis.risks ?? [];
  const pending = p?.evidence.filter((e) => e.status === 'pending') ?? [];
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <span className="brandmark">◈</span> GroupPilot
          <span className="beta">BETA</span>
        </div>
        <small>你的專案，開始有人照看。</small>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              className={view === id ? 'active' : ''}
              onClick={() => setView(id)}
            >
              <Icon size={18} />
              {label}
              {id === 'contribution' && pending.length > 0 && (
                <i>{pending.length}</i>
              )}
            </button>
          ))}
        </nav>
        <div className="sideproject">
          <span className="dot" />
          進行中的專案<strong>{p?.name ?? '載入中'}</strong>
          <div className="progress">
            <div style={{ width: percent + '%' }} />
          </div>
          <small>{percent}% 已驗收</small>
        </div>
        <div className="sidebottom">
          <div className="mini-pilot">
            <Bot size={19} />
            <div>
              代理組長<span>規則排程模式</span>
            </div>
            <span className="dot" />
          </div>
          <small>INNOSERVE 2026 · GroupPilot</small>
        </div>
      </aside>
      <main>
        <header>
          <span>
            工作空間 <ChevronRight size={14} /> {p?.name ?? '載入中'}
          </span>
          <div className="header-right">
            <span className="badge neutral">
              {p?.demo ? '示範資料' : '專案'}
            </span>
            <button className="btn" onClick={onWorkspace}>
              切換專案
            </button>
            <a
              className="btn"
              href="/signout-with-chatgpt?return_to=%2F"
              target="_top"
            >
              登出
            </a>
            <span className="avatar small">
              {person(data?.currentUserId ?? '')?.name.slice(0, 1) ?? '我'}
            </span>
          </div>
        </header>
        {error && (
          <div className="error" role="alert">
            {error}
            <button
              onClick={() =>
                load()
                  .then(() => setError(''))
                  .catch((e) => setError(e.message))
              }
            >
              重新載入
            </button>
          </div>
        )}
        {toast && (
          <div className="toast" role="status">
            <Check size={17} />
            {toast}
          </div>
        )}
        {!data ? (
          <div className="loading">
            <Loader2 className="spin" />
            <h2>正在載入團隊工作空間</h2>
            <p>建立任務、分工與成果紀錄的共同視圖。</p>
          </div>
        ) : (
          <>
            <div className="heading">
              <div>
                <p className="eyebrow">
                  {view === 'agent'
                    ? 'AI 代理工作台'
                    : view === 'overview'
                      ? 'PROJECT OVERVIEW'
                      : view === 'tasks'
                        ? 'TASKS & DEPENDENCIES'
                        : view === 'team'
                          ? 'TEAM CAPACITY'
                          : view === 'contribution'
                            ? 'CONTRIBUTION INSIGHTS'
                            : view === 'files'
                              ? 'TEAM FILES'
                              : 'AGENT ACTIVITY'}
                </p>
                <h1>
                  {view === 'agent'
                    ? 'AI 代理工作台'
                    : view === 'overview'
                      ? '讓團隊專注，把協調交給我。'
                      : view === 'tasks'
                        ? '每一步，都有清楚的下一步。'
                        : view === 'team'
                          ? '合適的人，做合適的事。'
                          : view === 'contribution'
                            ? '每一份付出，都有跡可循。'
                            : view === 'files'
                              ? '從專案資料，到最後交付。'
                              : '看見每一次協調的來由。'}
                </h1>
                <p>
                  {p!.name} <span className="separator">/</span>{' '}
                  {p!.members.length} 位組員{' '}
                  <span className="separator">/</span> 截止{' '}
                  {dateLabel(p!.deadline)}
                </p>
              </div>
              <div className="actions">
                <button
                  className="btn"
                  onClick={() =>
                    open('project', {
                      name: p!.name,
                      requirements: p!.requirements,
                      deadline: p!.deadline,
                    })
                  }
                >
                  <Settings2 size={16} />
                  專案設定
                </button>
                <button className="btn primary" onClick={() => report()}>
                  <Plus size={17} />
                  回報進度
                </button>
              </div>
            </div>
            {view === 'files' && (
              <FileCenter
                project={p!}
                userId={data.currentUserId}
                onSubmit={(id) => evidence(p!.tasks.find((t) => t.id === id))}
              />
            )}
            {view === 'agent' && data.role !== 'owner' && (
              <section className="panel">
                <p>AI 操作由專案建立者執行，請聯絡組長。</p>
              </section>
            )}
            {view === 'agent' && data.role === 'owner' && (
              <AgentPanel
                project={data.project}
                revision={data.revision}
                status={data.aiStatus}
                onRefresh={load}
              />
            )}
            {view === 'overview' && (
              <>
                <section className="pilot">
                  <div className="pilot-body">
                    <span className="badge">
                      <span className="dot" />
                      代理組長 · {p!.auto ? '自動協調開啟' : '手動協調'}
                    </span>
                    <h2>
                      {risks.length
                        ? '發現了阻礙，我們一起調整。'
                        : '目前步調穩定，繼續向前。'}
                    </h2>
                    <p>
                      {risks.length
                        ? risks[0].title + '。' + risks[0].detail
                        : '依現有技能、每日工時與任務依賴，團隊有可執行的排程。'}
                    </p>
                    <button
                      disabled={busy}
                      className="btn light"
                      onClick={() => run('replan')}
                    >
                      <RefreshCw size={16} />
                      檢查並重新分工
                      <ArrowUpRight size={16} />
                    </button>
                    <button
                      className="ai-link"
                      disabled={busy}
                      onClick={() => setView('agent')}
                    >
                      <Bot size={15} />
                      AI 深入分析
                    </button>
                  </div>
                  <div className="pilot-visual">
                    <div className="orbit one" />
                    <div className="orbit two" />
                    <div className="pilot-symbol">
                      <Bot size={55} />
                    </div>
                    <span className="satellite s1">
                      <Check size={18} />
                    </span>
                    <span className="satellite s2">
                      <GitBranch size={18} />
                    </span>
                  </div>
                </section>
                <div className="mode-note">
                  <span>
                    <span className="dot" />
                    {data.aiConnected
                      ? 'AI 設定已就緒 · 實際連線待驗證'
                      : '規則排程運作中 · 尚未接通語言模型'}
                  </span>
                  <span>頁面開啟時每分鐘檢查 · 回報後即時更新</span>
                </div>
                <section className="stats">
                  {[
                    [
                      '已驗收完成度',
                      percent + '%',
                      `${completed.length} / ${p!.tasks.length} 項任務完成`,
                      ChartNoAxesCombined,
                    ],
                    [
                      '預估完成日期',
                      data.analysis.finishDate
                        ? dateLabel(data.analysis.finishDate)
                        : '待協調',
                      '依每日可用工時估算',
                      Clock,
                    ],
                    [
                      '待處理風險',
                      risks.length + ' 項',
                      risks.length ? '需要團隊留意' : '目前沒有逾期或容量風險',
                      AlertTriangle,
                    ],
                    [
                      '已驗收紀錄',
                      p!.evidence.filter((e) => e.status === 'accepted')
                        .length + ' 筆',
                      pending.length + ' 筆等待交叉驗收',
                      FileCheck,
                    ],
                  ].map(([a, b, c, Icon]: any) => (
                    <article key={a}>
                      <div className="stat-label">
                        {a}
                        <Icon size={17} />
                      </div>
                      <strong>{b}</strong>
                      <p>{c}</p>
                      {a === '已驗收完成度' && (
                        <div className="progress">
                          <div style={{ width: percent + '%' }} />
                        </div>
                      )}
                    </article>
                  ))}
                </section>
                <div className="columns">
                  <section className="panel">
                    <div className="section-title">
                      <h2>團隊工作量</h2>
                      <button
                        className="textbtn"
                        onClick={() => setView('team')}
                      >
                        查看分工
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                    <p className="subtle">
                      剩餘任務工時，與每人的可投入時間一起看。
                    </p>
                    {data.contributions.map((c) => (
                      <div className="member-row" key={c.member.id}>
                        {avatar(c.member)}
                        <div className="grow">
                          <div className="row">
                            <strong>{c.member.name}</strong>
                            <span>
                              {c.load} hr <small>待投入</small>
                            </span>
                          </div>
                          <div className="progress">
                            <div
                              style={{
                                width: Math.min((c.load / 25) * 100, 100) + '%',
                                background: c.member.color,
                              }}
                            />
                          </div>
                        </div>
                        <span className="daily">
                          {c.member.dailyHours} hr / 日
                        </span>
                      </div>
                    ))}
                  </section>
                  <section className="panel">
                    <div className="section-title">
                      <h2>代理組長動態</h2>
                      <span className="badge neutral">持續追蹤</span>
                    </div>
                    <div className="timeline">
                      {p!.events.slice(0, 3).map((e) => (
                        <div key={e.id}>
                          <span className="timeline-icon">
                            <Bot size={16} />
                          </span>
                          <div>
                            <strong>{e.title}</strong>
                            <p>{e.detail}</p>
                            <small>
                              {new Date(e.at).toLocaleString('zh-TW', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      className="textbtn"
                      onClick={() => setView('activity')}
                    >
                      查看完整協調紀錄
                      <ArrowUpRight size={15} />
                    </button>
                  </section>
                </div>
                <section className="panel">
                  <div className="section-title">
                    <h2>下一步，從這裡開始</h2>
                    <button
                      className="textbtn"
                      onClick={() => setView('tasks')}
                    >
                      所有任務
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {p!.tasks
                    .filter((t) => t.status !== 'done')
                    .slice(0, 3)
                    .map((t) => (
                      <div className="next-task" key={t.id}>
                        <span className={'task-dot ' + t.status} />
                        <div className="grow">
                          <strong>{t.title}</strong>
                          <p>
                            {t.deps.some(
                              (id) => !completed.some((d) => d.id === id),
                            )
                              ? '等待 ' +
                                t.deps
                                  .filter(
                                    (id) => !completed.some((d) => d.id === id),
                                  )
                                  .map(taskName)
                                  .join('、')
                              : '前置工作已完成，可以開始'}
                          </p>
                        </div>
                        {avatar(person(t.owner))}
                        <span className="due">{dateLabel(t.due)}</span>
                        <button
                          className="btn compact"
                          onClick={() => evidence(t)}
                        >
                          提交成果
                        </button>
                      </div>
                    ))}
                </section>
              </>
            )}
            {view === 'tasks' && (
              <>
                <div className="toolbar">
                  <div className="filters">
                    {[
                      ['all', '全部任務'],
                      ['todo', '待開始'],
                      ['doing', '進行中'],
                      ['review', '待驗收'],
                      ['done', '已完成'],
                    ].map(([v, l]) => (
                      <button
                        className={filter === v ? 'selected' : ''}
                        onClick={() => setFilter(v)}
                        key={v}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <button className="btn primary" onClick={taskForm}>
                    <Plus size={16} />
                    新增任務
                  </button>
                </div>
                <section className="panel flow-panel">
                  <div className="section-title">
                    <h2>任務依賴與排程</h2>
                    <button
                      disabled={busy}
                      className="btn compact"
                      onClick={() => run('replan')}
                    >
                      <RefreshCw size={14} />
                      重新分工
                    </button>
                  </div>
                  <p>
                    前置成果驗收後，後續任務才可完成驗收。預估日期已計入每位組員的工作順序。
                  </p>
                  <div className="task-list">
                    {p!.tasks
                      .filter((t) => filter === 'all' || t.status === filter)
                      .map((t, i) => (
                        <div className="task-card" key={t.id}>
                          <div className="task-number">
                            {String(i + 1).padStart(2, '0')}
                          </div>
                          <div className="grow">
                            <div className="row task-title">
                              <strong>{t.title}</strong>
                              <span className={'status ' + t.status}>
                                {statuses[t.status]}
                              </span>
                            </div>
                            <div className="task-meta">
                              <span>{skillNames[t.skill]}</span>
                              <span>
                                {t.hours} hr{' '}
                                {t.status === 'done' ? '原估' : '剩餘'}
                              </span>
                              <span>難度 {t.difficulty}</span>
                              <span>預估 {dateLabel(t.due)}</span>
                            </div>
                            <div className="deps">
                              <GitBranch size={14} />
                              {t.deps.length ? (
                                t.deps.map((id) => (
                                  <span
                                    className={
                                      completed.some((d) => d.id === id)
                                        ? 'fulfilled'
                                        : ''
                                    }
                                    key={id}
                                  >
                                    {taskName(id)}
                                  </span>
                                ))
                              ) : (
                                <span>無前置任務</span>
                              )}
                            </div>
                            <details>
                              <summary>完成標準</summary>
                              <p>{t.criteria}</p>
                            </details>
                          </div>
                          <div className="task-owner">
                            {avatar(person(t.owner))}
                            <small>{person(t.owner)?.name ?? '待分工'}</small>
                          </div>
                          <div className="task-actions">
                            {t.status !== 'done' && (
                              <>
                                <button
                                  className="btn compact"
                                  onClick={() => report(t)}
                                >
                                  回報
                                </button>
                                <button
                                  className="textbtn"
                                  onClick={() => evidence(t)}
                                >
                                  提交成果
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                  {!p!.tasks.some(
                    (t) => filter === 'all' || t.status === filter,
                  ) && <div className="empty">這個分類目前沒有任務。</div>}
                </section>
              </>
            )}
            {view === 'team' && (
              <>
                <div className="notice">
                  <Bot size={22} />
                  <div>
                    <strong>分工會配合真實的可用時間</strong>
                    <p>
                      更新技能、偏好或可工作日期後，
                      {p!.auto ? '代理組長會自動重算' : '可手動重新計算'}
                      。每次轉交保留原有貢獻，並計入半天交接緩衝。
                    </p>
                  </div>
                  <button
                    className="btn"
                    onClick={() => run('auto', { enabled: !p!.auto })}
                  >
                    自動分工：{p!.auto ? '開啟' : '關閉'}
                  </button>
                </div>
                <div className="team-grid">
                  {data.contributions.map((c) => (
                    <section className="panel team-card" key={c.member.id}>
                      <div className="row">
                        {avatar(c.member)}
                        <button
                          className="textbtn"
                          onClick={() =>
                            open('member', {
                              memberId: c.member.id,
                              dailyHours: c.member.dailyHours,
                              unavailableUntil: c.member.unavailableUntil,
                              skills: c.member.skills,
                              preference: c.member.preference,
                            })
                          }
                        >
                          調整
                          <Settings2 size={15} />
                        </button>
                      </div>
                      <h2>{c.member.name}</h2>
                      <p>{c.member.role}</p>
                      <div className="skill-tags">
                        {c.member.skills.map((s) => (
                          <span key={s}>{skillNames[s]}</span>
                        ))}
                      </div>
                      <div className="team-metrics">
                        <div>
                          <strong>
                            {c.member.dailyHours}
                            <small> hr</small>
                          </strong>
                          <p>每日可投入</p>
                        </div>
                        <div>
                          <strong>
                            {c.load}
                            <small> hr</small>
                          </strong>
                          <p>剩餘工作</p>
                        </div>
                      </div>
                      <p>
                        可開始：{c.member.unavailableUntil}
                        <br />
                        偏好：{skillNames[c.member.preference]}
                      </p>
                      <div className="assigned">
                        {p!.tasks
                          .filter(
                            (t) =>
                              t.owner === c.member.id && t.status !== 'done',
                          )
                          .map((t) => (
                            <div key={t.id}>
                              <span>{t.title}</span>
                              <small>{t.hours} hr</small>
                            </div>
                          ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}
            {view === 'contribution' && (
              <>
                <div className="notice">
                  <FileCheck size={22} />
                  <div>
                    <strong>貢獻依成果計算，也保留協作付出</strong>
                    <p>
                      分數來自交叉驗收紀錄，自報工時不直接等於貢獻。提交與驗收身分由登入帳號確認。
                    </p>
                  </div>
                  <button className="btn primary" onClick={() => evidence()}>
                    <Plus size={16} />
                    提交紀錄
                  </button>
                </div>
                <div className="columns contribution-columns">
                  <section className="panel">
                    <div className="section-title">
                      <h2>已驗收貢獻占比</h2>
                      <span className="badge neutral">可追溯</span>
                    </div>
                    {data.contributions.map((c) => (
                      <div className="contrib-row" key={c.member.id}>
                        {avatar(c.member)}
                        <div className="grow">
                          <div className="row">
                            <strong>{c.member.name}</strong>
                            <strong>{c.share}%</strong>
                          </div>
                          <div className="progress">
                            <div
                              style={{
                                width: c.share + '%',
                                background: c.member.color,
                              }}
                            />
                          </div>
                          <small>
                            {c.score} 成果點 · {c.accepted} 筆已驗收 ·{' '}
                            {c.pending} 筆待驗收
                          </small>
                        </div>
                      </div>
                    ))}
                  </section>
                  <section className="panel formula">
                    <p className="eyebrow">HOW IT WORKS</p>
                    <h2>公平，從透明開始。</h2>
                    <p>每項任務成果點上限：</p>
                    <div className="formula-box">原估工時 × 任務難度</div>
                    <p>
                      同一任務有多位貢獻者時，以已驗收紀錄的工時比例分配該任務點數，重複提交不會增加總額。
                    </p>
                    <p>
                      協作紀錄另設原任務點數 25%
                      的上限；只計已驗收紀錄。重新分工不改變已提交紀錄的作者。
                    </p>
                    <small>這是團隊協調參考，不代表個人能力或成績。</small>
                  </section>
                </div>
                <section className="panel">
                  <div className="section-title">
                    <h2>成果與協作紀錄</h2>
                    <span className="badge neutral">
                      {pending.length} 筆待驗收
                    </span>
                  </div>
                  <div className="evidence-list">
                    {[...p!.evidence].reverse().map((e) => (
                      <div className="evidence-card" key={e.id}>
                        {avatar(person(e.memberId))}
                        <div className="grow">
                          <div className="row">
                            <strong>
                              {person(e.memberId)?.name}{' '}
                              <span className="muted">
                                · {taskName(e.taskId)}
                              </span>
                            </strong>
                            <span
                              className={
                                'status ' +
                                (e.status === 'accepted'
                                  ? 'done'
                                  : e.status === 'pending'
                                    ? 'review'
                                    : 'todo')
                              }
                            >
                              {e.status === 'accepted'
                                ? '已驗收'
                                : e.status === 'pending'
                                  ? '待驗收'
                                  : '已退回'}
                            </span>
                          </div>
                          <p>{e.note}</p>
                          <div className="task-meta">
                            <span>
                              {e.kind === 'delivery' ? '成果交付' : '協作支援'}
                            </span>
                            <span>自報 {e.hours} hr</span>
                            <span>{dateLabel(e.createdAt.slice(0, 10))}</span>
                            {e.reviewer && (
                              <span>驗收：{person(e.reviewer)?.name}</span>
                            )}
                            {e.fileIds?.length ? (
                              <EvidenceAttachments ids={e.fileIds} />
                            ) : null}
                            {e.url && (
                              <a href={e.url} target="_blank" rel="noreferrer">
                                <LinkIcon size={13} />
                                成果連結
                              </a>
                            )}
                          </div>
                          {e.status === 'pending' &&
                            e.memberId !== data.currentUserId && (
                              <button
                                className="btn compact"
                                onClick={() =>
                                  open('review', {
                                    evidenceId: e.id,
                                    memberId: p!.members.find(
                                      (m) => m.id !== e.memberId,
                                    )?.id,
                                    accept: true,
                                  })
                                }
                              >
                                交叉驗收
                              </button>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <h2>投入紀錄與工作負擔</h2>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>組員</th>
                          <th>自報投入</th>
                          <th>已驗收紀錄</th>
                          <th>剩餘分工</th>
                          <th>每日可投入</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.contributions.map((c) => (
                          <tr key={c.member.id}>
                            <td>{c.member.name}</td>
                            <td>{c.hours} hr</td>
                            <td>{c.accepted} 筆</td>
                            <td>{c.load} hr</td>
                            <td>{c.member.dailyHours} hr</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
            {view === 'activity' && (
              <section className="panel">
                <div className="section-title">
                  <h2>協調與決策紀錄</h2>
                  <button
                    className="btn"
                    onClick={() => run('replan')}
                    disabled={busy}
                  >
                    <RefreshCw size={16} />
                    立即檢查
                  </button>
                </div>
                <p>
                  站內紀錄保存每次回報、調整原因與驗收結果。外部訊息通知尚未串接。
                </p>
                <div className="timeline full">
                  {p!.events.map((e) => (
                    <div key={e.id}>
                      <span className="timeline-icon">
                        {e.kind === 'evidence' ? (
                          <FileCheck size={17} />
                        ) : e.kind === 'report' ? (
                          <Send size={17} />
                        ) : (
                          <Bot size={17} />
                        )}
                      </span>
                      <div>
                        <strong>{e.title}</strong>
                        <p>{e.detail}</p>
                        <small>{new Date(e.at).toLocaleString('zh-TW')}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section className="panel invite-panel">
              <div>
                <h2>團隊邀請</h2>
                <p>
                  組員登入後，在「加入團隊」貼上邀請碼即可加入。新成員請到「團隊與分工」設定自己的技能。
                </p>
              </div>
              {data.role === 'owner' ? (
                <>
                  <button
                    className="btn"
                    onClick={async () => {
                      try {
                        const r = await apiFetch('/api/workspace', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'invite' }),
                        });
                        const j: any = await r.json();
                        if (!r.ok) throw Error(j.error);
                        setInviteCode(j.code);
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    顯示邀請碼
                  </button>
                  {inviteCode && (
                    <label>
                      僅分享給你的組員
                      <input
                        readOnly
                        value={inviteCode}
                        onFocus={(e) => e.target.select()}
                      />
                    </label>
                  )}
                </>
              ) : (
                <p>請向專案建立者索取邀請碼。</p>
              )}
            </section>
            <footer>
              <span>
                GroupPilot{' '}
                <span className="muted"> / 每個團隊，都值得被好好協調。</span>
              </span>
              <span>
                最近檢查{' '}
                {new Date(p!.lastCheck).toLocaleTimeString('zh-TW', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </footer>
          </>
        )}
        {modal && p && (
          <div
            className="modal-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget && !busy) setModal('');
            }}
          >
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dialog-title"
            >
              <div className="section-title">
                <h2 id="dialog-title">
                  {
                    {
                      report: '回報進度與阻礙',
                      evidence: '提交成果或協作紀錄',
                      review: '交叉驗收',
                      member: '調整能力與可用時間',
                      task: '新增任務',
                      project: '專案設定',
                      analysis: 'AI 專案與貢獻分析',
                    }[modal]
                  }
                </h2>
                <button
                  className="iconbtn"
                  aria-label="關閉"
                  onClick={() => setModal('')}
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={submit}>
                {modal === 'analysis' && (
                  <div>
                    {aiResult ? (
                      <>
                        <h3>{aiResult.summary}</h3>
                        {[
                          ['risks', '風險觀察'],
                          ['suggestions', '協調建議'],
                          ['contributionNotes', '貢獻觀察'],
                          ['questions', '需要確認'],
                        ].map(([key, label]) => (
                          <div key={key}>
                            <h4>{label}</h4>
                            <ul>
                              {aiResult[key].map((text: string, i: number) => (
                                <li key={i}>{text}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        <p>
                          AI
                          建議尚未更改分工。請回到專案執行重新分工或更新資料。
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          尚未連接語言模型。目前的自動分工、時程與貢獻計算由規則引擎執行。
                        </p>
                        <p>
                          啟用 AI
                          後，可根據專案現況獲得風險、協調與貢獻分析建議。請由專案開發者完成後端金鑰設定。
                        </p>
                      </>
                    )}
                  </div>
                )}
                {['report', 'evidence'].includes(modal) && (
                  <>
                    <label>
                      任務
                      <select
                        value={form.taskId}
                        onChange={(e) => {
                          const t = p.tasks.find(
                            (t) => t.id === e.target.value,
                          )!;
                          setForm({
                            ...form,
                            taskId: t.id,
                            memberId: data.currentUserId,
                            fileIds: [],
                            remainingHours: t.hours,
                          });
                        }}
                      >
                        {p.tasks
                          .filter(
                            (t) => modal === 'evidence' || t.status !== 'done',
                          )
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      回報組員
                      <select
                        disabled
                        value={data.currentUserId}
                        onChange={(e) => field('memberId', e.target.value)}
                      >
                        {p.members
                          .filter(
                            (m) =>
                              modal === 'evidence' ||
                              p.tasks.find((t) => t.id === form.taskId)
                                ?.owner === m.id,
                          )
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </>
                )}
                {modal === 'report' && (
                  <>
                    <label>
                      目前完成內容／遇到的阻礙
                      <textarea
                        autoFocus
                        required
                        maxLength={2000}
                        value={form.note}
                        onChange={(e) => field('note', e.target.value)}
                        placeholder="例如：欄位已整理完成，還剩關聯設計；這三天要準備考試。"
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        預估剩餘工時
                        <input
                          type="number"
                          min="0.5"
                          max="80"
                          step="0.5"
                          required
                          value={form.remainingHours}
                          onChange={(e) =>
                            field('remainingHours', +e.target.value)
                          }
                        />
                      </label>
                      <label>
                        最早可繼續工作的日期
                        <input
                          required
                          type="date"
                          value={form.unavailableUntil}
                          onChange={(e) =>
                            field('unavailableUntil', e.target.value)
                          }
                        />
                      </label>
                    </div>
                    <p>
                      此表單使用明確工時與日期；也可到「AI
                      代理組長」解析自然語言回報。
                    </p>
                  </>
                )}
                {modal === 'evidence' && (
                  <>
                    <AttachmentPicker
                      key={form.taskId}
                      taskId={form.taskId}
                      userId={data.currentUserId}
                      value={form.fileIds ?? []}
                      onChange={(v) => field('fileIds', v)}
                    />
                    <div className="form-grid">
                      <label>
                        紀錄類型
                        <select
                          value={form.kind}
                          onChange={(e) => field('kind', e.target.value)}
                        >
                          <option value="delivery">成果交付</option>
                          <option value="support">協作支援</option>
                        </select>
                      </label>
                      <label>
                        本次投入工時
                        <input
                          required
                          type="number"
                          min="0.25"
                          max="80"
                          step="0.25"
                          value={form.hours}
                          onChange={(e) => field('hours', +e.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      成果或協作內容
                      <textarea
                        required
                        maxLength={2000}
                        value={form.note}
                        onChange={(e) => field('note', e.target.value)}
                        placeholder="說明完成哪些內容，以及可以如何驗證。"
                      />
                    </label>
                    <label>
                      成果連結（選填）
                      <input
                        type="url"
                        value={form.url}
                        onChange={(e) => field('url', e.target.value)}
                        placeholder="https://…"
                      />
                    </label>
                    <p>提交後需由另一位組員驗收，才列入貢獻分數。</p>
                  </>
                )}
                {modal === 'review' && (
                  <>
                    <p>
                      請檢查成果是否符合任務完成標準。只能以自己的登入身分驗收，不能驗收自己的成果。
                    </p>
                    <label>
                      驗收組員
                      <select
                        value={form.memberId}
                        onChange={(e) => field('memberId', e.target.value)}
                      >
                        {p.members
                          .filter(
                            (m) =>
                              m.id !==
                              p.evidence.find((e) => e.id === form.evidenceId)
                                ?.memberId,
                          )
                          .map((m) => (
                            <option value={m.id} key={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      驗收結果
                      <select
                        value={form.accept ? 'yes' : 'no'}
                        onChange={(e) =>
                          field('accept', e.target.value === 'yes')
                        }
                      >
                        <option value="yes">通過，符合完成標準</option>
                        <option value="no">退回，仍需補充</option>
                      </select>
                    </label>
                  </>
                )}
                {modal === 'member' && (
                  <>
                    <h3>{person(form.memberId)?.name}</h3>
                    <div className="form-grid">
                      <label>
                        每日可投入工時
                        <input
                          required
                          type="number"
                          min="0"
                          max="8"
                          step="0.5"
                          value={form.dailyHours}
                          onChange={(e) => field('dailyHours', +e.target.value)}
                        />
                      </label>
                      <label>
                        可開始工作日期
                        <input
                          required
                          type="date"
                          value={form.unavailableUntil}
                          onChange={(e) =>
                            field('unavailableUntil', e.target.value)
                          }
                        />
                      </label>
                    </div>
                    <fieldset>
                      <legend>可負責的技能</legend>
                      <div className="checkboxes">
                        {Object.entries(skillNames).map(([k, v]) => (
                          <label key={k}>
                            <input
                              type="checkbox"
                              checked={form.skills.includes(k)}
                              onChange={(e) =>
                                field(
                                  'skills',
                                  e.target.checked
                                    ? [...form.skills, k]
                                    : form.skills.filter(
                                        (s: string) => s !== k,
                                      ),
                                )
                              }
                            />
                            {v}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label>
                      偏好任務
                      <select
                        value={form.preference}
                        onChange={(e) => field('preference', e.target.value)}
                      >
                        {form.skills.map((s: string) => (
                          <option key={s} value={s}>
                            {skillNames[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {modal === 'task' && (
                  <>
                    <label>
                      任務名稱
                      <input
                        autoFocus
                        required
                        maxLength={120}
                        value={form.title}
                        onChange={(e) => field('title', e.target.value)}
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        需要技能
                        <select
                          value={form.skill}
                          onChange={(e) => field('skill', e.target.value)}
                        >
                          {Object.entries(skillNames).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        預估工時
                        <input
                          required
                          type="number"
                          min="0.5"
                          max="80"
                          step="0.5"
                          value={form.hours}
                          onChange={(e) => field('hours', +e.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      難度
                      <select
                        value={form.difficulty}
                        onChange={(e) => field('difficulty', +e.target.value)}
                      >
                        <option value={1}>1 · 基礎</option>
                        <option value={2}>2 · 中等</option>
                        <option value={3}>3 · 複雜</option>
                      </select>
                    </label>
                    <fieldset>
                      <legend>前置任務</legend>
                      <div className="checkboxes">
                        {p.tasks.map((t) => (
                          <label key={t.id}>
                            <input
                              type="checkbox"
                              checked={form.deps.includes(t.id)}
                              onChange={(e) =>
                                field(
                                  'deps',
                                  e.target.checked
                                    ? [...form.deps, t.id]
                                    : form.deps.filter(
                                        (id: string) => id !== t.id,
                                      ),
                                )
                              }
                            />
                            {t.title}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label>
                      完成標準
                      <textarea
                        required
                        maxLength={500}
                        value={form.criteria}
                        onChange={(e) => field('criteria', e.target.value)}
                      />
                    </label>
                  </>
                )}
                {modal === 'project' && (
                  <>
                    <label>
                      專案名稱
                      <input
                        required
                        maxLength={100}
                        value={form.name}
                        onChange={(e) => field('name', e.target.value)}
                      />
                    </label>
                    <label>
                      作業要求
                      <textarea
                        required
                        maxLength={12000}
                        value={form.requirements}
                        onChange={(e) => field('requirements', e.target.value)}
                      />
                    </label>
                    <label>
                      讀入文字檔（.txt）
                      <input
                        type="file"
                        accept=".txt,text/plain"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            if (f.size > 48000) {
                              setError('請使用小於 48 KB 的文字檔');
                              return;
                            }
                            field(
                              'requirements',
                              (await f.text()).slice(0, 12000),
                            );
                          }
                        }}
                      />
                    </label>
                    <label>
                      截止日期
                      <input
                        required
                        type="date"
                        value={form.deadline}
                        onChange={(e) => field('deadline', e.target.value)}
                      />
                    </label>
                    <p>
                      要求會保存至專案；可到「AI
                      代理組長」拆解需求，確認後新增任務。
                    </p>
                  </>
                )}
                {error && (
                  <div className="error" role="alert">
                    {error}
                  </div>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setModal('')}
                  >
                    取消
                  </button>
                  {modal !== 'analysis' && (
                    <button
                      type="submit"
                      className="btn primary"
                      disabled={busy}
                    >
                      {busy ? (
                        <Loader2 className="spin" size={16} />
                      ) : (
                        <Check size={16} />
                      )}
                      儲存{modal === 'report' && p.auto ? '並自動協調' : ''}
                    </button>
                  )}
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
