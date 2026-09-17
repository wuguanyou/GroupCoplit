export type Member = {
  id: string;
  name: string;
  role: string;
  skills: string[];
  preference: string;
  dailyHours: number;
  unavailableUntil: string;
  color: string;
};
export type Task = {
  id: string;
  title: string;
  skill: string;
  hours: number;
  estimate: number;
  difficulty: number;
  deps: string[];
  owner: string;
  status: 'todo' | 'doing' | 'review' | 'done';
  due: string;
  criteria: string;
};
export type Evidence = {
  fileIds?: string[];
  id: string;
  taskId: string;
  memberId: string;
  kind: 'delivery' | 'support';
  hours: number;
  note: string;
  url: string;
  status: 'pending' | 'accepted' | 'rejected';
  reviewer: string;
  createdAt: string;
};
export type Event = {
  id: string;
  title: string;
  detail: string;
  at: string;
  kind: 'plan' | 'report' | 'evidence' | 'risk';
};
export type Project = {
  appliedAgentRuns?: string[];
  name: string;
  requirements: string;
  deadline: string;
  members: Member[];
  tasks: Task[];
  evidence: Evidence[];
  events: Event[];
  auto: boolean;
  lastCheck: string;
  demo: boolean;
};
export const day = (d = new Date()) => d.toISOString().slice(0, 10);
export function addDays(date: string, n: number) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return day(d);
}
const diff = (a: string, b: string) =>
  (Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000;
export function log(
  p: Project,
  title: string,
  detail: string,
  kind: Event['kind'] = 'plan',
) {
  p.events.unshift({
    id: crypto.randomUUID(),
    title,
    detail,
    kind,
    at: new Date().toISOString(),
  });
  p.events = p.events.slice(0, 150);
}
export function seed(): Project {
  const today = day();
  const members: Member[] = [
    {
      id: 'm1',
      name: '冠佑',
      role: '前端與整合',
      skills: ['frontend', 'planning', 'testing'],
      preference: 'frontend',
      dailyHours: 2,
      unavailableUntil: today,
      color: '#3b8b77',
    },
    {
      id: 'm2',
      name: '子晴',
      role: '體驗與設計',
      skills: ['design', 'planning', 'presentation'],
      preference: 'design',
      dailyHours: 2,
      unavailableUntil: today,
      color: '#d59a43',
    },
    {
      id: 'm3',
      name: '柏宇',
      role: '後端與資料',
      skills: ['backend', 'database', 'ai'],
      preference: 'backend',
      dailyHours: 2,
      unavailableUntil: today,
      color: '#5f86ba',
    },
    {
      id: 'm4',
      name: '品蓉',
      role: 'AI 與品質',
      skills: ['database', 'ai', 'testing', 'presentation'],
      preference: 'ai',
      dailyHours: 2,
      unavailableUntil: today,
      color: '#9882b1',
    },
  ];
  const specs: [string, string, string, number, string[], string][] = [
    ['t1', '需求分析與訪談', 'planning', 3, [], 'm1'],
    ['t2', '功能範圍與驗收標準', 'planning', 2, ['t1'], 'm2'],
    ['t3', '介面流程與 Wireframe', 'design', 4, ['t2'], 'm2'],
    ['t4', 'Database Schema', 'database', 4, ['t2'], 'm3'],
    ['t5', 'API 規格與 Mock 資料', 'backend', 3, ['t4'], 'm3'],
    ['t6', '前端畫面與互動', 'frontend', 6, ['t3', 't5'], 'm1'],
    ['t7', '後端 API 開發', 'backend', 6, ['t5'], 'm3'],
    ['t8', 'AI 問答服務整合', 'ai', 5, ['t5'], 'm4'],
    ['t9', '整合測試與修正', 'testing', 4, ['t6', 't7', 't8'], 'm4'],
    ['t10', '書面報告與簡報', 'presentation', 4, ['t2'], 'm2'],
    ['t11', 'Demo 排練與交付', 'presentation', 2, ['t9', 't10'], 'm4'],
  ];
  const tasks: Task[] = specs.map(
    ([id, title, skill, hours, deps, owner], i) => ({
      id,
      title,
      skill,
      hours,
      estimate: hours,
      difficulty: i > 3 && i < 9 ? 2 : 1,
      deps,
      owner,
      status: i < 3 ? 'done' : i === 3 ? 'doing' : 'todo',
      due: addDays(today, Math.min(i + 1, 13)),
      criteria: `提交「${title}」成果，附可檢視的文件或說明，經另一位組員驗收。`,
    }),
  );
  const p: Project = {
    name: '校園 AI 系統',
    requirements:
      '建立校園 AI 問答系統，包含校務資訊查詢、友善介面、資料庫、測試報告、書面報告與 Demo。',
    deadline: addDays(today, 14),
    members,
    tasks,
    evidence: tasks.slice(0, 3).map((t, i) => ({
      id: 'e' + i,
      taskId: t.id,
      memberId: t.owner,
      kind: 'delivery',
      hours: t.hours,
      note: [
        '完成 5 位學生需求訪談與問題分類（示範紀錄）',
        '確認核心功能與驗收條件（示範紀錄）',
        '完成主要頁面 Wireframe（示範紀錄）',
      ][i],
      url: '',
      status: 'accepted',
      reviewer: i === 0 ? 'm2' : 'm1',
      createdAt: new Date().toISOString(),
    })),
    events: [],
    auto: true,
    lastCheck: new Date().toISOString(),
    demo: true,
  };
  log(
    p,
    '代理組長已就位',
    '示範資料已載入。調整成員可用時間，試試自動重新分工。',
  );
  return p;
}
export const skillNames: Record<string, string> = {
  planning: '需求規劃',
  design: '介面設計',
  frontend: '前端',
  backend: '後端',
  database: '資料庫',
  ai: 'AI 整合',
  testing: '測試',
  presentation: '報告簡報',
};
export function ordered(tasks: Task[]) {
  const sorted: Task[] = [];
  const seen = new Set<string>();
  const visiting = new Set<string>();
  const visit = (t: Task) => {
    if (seen.has(t.id)) return;
    if (visiting.has(t.id)) throw Error('任務依賴形成循環');
    visiting.add(t.id);
    for (const id of t.deps) {
      const d = tasks.find((x) => x.id === id);
      if (!d) throw Error('找不到前置任務');
      visit(d);
    }
    visiting.delete(t.id);
    seen.add(t.id);
    sorted.push(t);
  };
  tasks.forEach(visit);
  return sorted;
}
export function schedule(p: Project, reassign = false, today = day()) {
  const free: Record<string, number> = {};
  const finish: Record<string, number> = {};
  const changes: {
    taskId: string;
    from: string;
    to: string;
    reason: string;
  }[] = [];
  const slots: { taskId: string; start: number; end: number; owner: string }[] =
    [];
  const warnings: string[] = [];
  p.members.forEach(
    (m) => (free[m.id] = Math.max(0, diff(m.unavailableUntil, today))),
  );
  for (const t of ordered(p.tasks)) {
    if (t.status === 'done') {
      finish[t.id] = 0;
      continue;
    }
    const ready = Math.max(0, ...t.deps.map((id) => finish[id] ?? 0));
    const candidates = p.members.filter(
      (m) => m.skills.includes(t.skill) && m.dailyHours > 0,
    );
    const end = (m: Member) =>
      Math.max(free[m.id], ready) + t.hours / m.dailyHours;
    let owner = p.members.find((m) => m.id === t.owner);
    if (reassign && t.status !== 'review' && candidates.length) {
      const ranked = [...candidates].sort(
        (a, b) =>
          end(a) +
          (a.preference === t.skill ? 0 : 0.15) +
          (a.id === t.owner ? 0 : 0.5) -
          (end(b) +
            (b.preference === t.skill ? 0 : 0.15) +
            (b.id === t.owner ? 0 : 0.5)),
      );
      const best = ranked[0];
      if (
        !owner ||
        owner.dailyHours <= 0 ||
        !owner.skills.includes(t.skill) ||
        end(best) + 0.5 < end(owner)
      ) {
        changes.push({
          taskId: t.id,
          from: t.owner,
          to: best.id,
          reason: `${best.name}具備${skillNames[t.skill] ?? t.skill}能力，每日可投入 ${best.dailyHours} 小時；已計入前置工作、現有排程及交接緩衝。`,
        });
        t.owner = best.id;
        owner = best;
      }
    }
    if (!owner || owner.dailyHours <= 0 || !owner.skills.includes(t.skill)) {
      warnings.push(`${t.title}：沒有具備技能與可用時間的負責人`);
      finish[t.id] = Infinity;
      slots.push({ taskId: t.id, start: ready, end: Infinity, owner: t.owner });
      continue;
    }
    const start = Math.max(free[owner.id], ready);
    const stop =
      start +
      t.hours / owner.dailyHours +
      (changes.some((c) => c.taskId === t.id) ? 0.5 : 0);
    finish[t.id] = stop;
    free[owner.id] = stop;
    slots.push({ taskId: t.id, start, end: stop, owner: owner.id });
    if (stop > Math.max(0, diff(p.deadline, today)))
      warnings.push(`${t.title}：預估超過專案期限`);
  }
  const duration = Math.max(0, ...Object.values(finish));
  return {
    slots,
    changes,
    warnings,
    duration,
    finishDate: Number.isFinite(duration)
      ? addDays(today, Math.ceil(duration))
      : null,
  };
}
export function analyze(p: Project, today = day()) {
  const result = schedule(p, false, today);
  const risks = p.tasks
    .filter((t) => t.status !== 'done' && t.due < today)
    .map((t) => ({
      taskId: t.id,
      title: `${t.title} 已逾期`,
      detail: `影響：${
        p.tasks
          .filter((x) => x.deps.includes(t.id) && x.status !== 'done')
          .map((x) => x.title)
          .join('、') || '目前沒有直接後續任務'
      }。請回報剩餘工時。`,
    }));
  for (const m of p.members.filter(
    (m) => m.unavailableUntil > today || m.dailyHours === 0,
  )) {
    const affected = p.tasks.filter(
      (t) => t.owner === m.id && t.status !== 'done',
    );
    if (affected.length)
      risks.push({
        taskId: affected[0].id,
        title: `${m.name} 的可用時間受限`,
        detail: `${affected.map((t) => t.title).join('、')}需要重新評估。`,
      });
  }
  result.warnings.forEach((w, i) =>
    risks.push({
      taskId: 'warning' + i,
      title: w,
      detail: '可考慮調整人力、縮小範圍或延長期限。',
    }),
  );
  return { ...result, risks };
}
export function contributions(p: Project) {
  const points = (e: Evidence) => {
    const t = p.tasks.find((t) => t.id === e.taskId);
    if (!t) return 0;
    const same = p.evidence.filter(
      (x) =>
        x.taskId === e.taskId && x.kind === e.kind && x.status === 'accepted',
    );
    const hours = same.reduce((s, x) => s + x.hours, 0);
    const budget =
      t.estimate * t.difficulty * (e.kind === 'delivery' ? 1 : 0.25);
    return hours ? (budget * e.hours) / hours : 0;
  };
  const total = p.evidence
    .filter((e) => e.status === 'accepted')
    .reduce((s, e) => s + points(e), 0);
  return p.members.map((m) => {
    const ev = p.evidence.filter((e) => e.memberId === m.id);
    const score = ev
      .filter((e) => e.status === 'accepted')
      .reduce((s, e) => s + points(e), 0);
    return {
      member: m,
      score: Math.round(score * 10) / 10,
      share: total ? Math.round((score / total) * 100) : 0,
      hours: ev.reduce((s, e) => s + e.hours, 0),
      accepted: ev.filter((e) => e.status === 'accepted').length,
      pending: ev.filter((e) => e.status === 'pending').length,
      load: p.tasks
        .filter((t) => t.owner === m.id && t.status !== 'done')
        .reduce((s, t) => s + t.hours, 0),
    };
  });
}
export function replan(p: Project) {
  const r = schedule(p, true);
  for (const c of r.changes) {
    const t = p.tasks.find((t) => t.id === c.taskId)!;
    log(
      p,
      `${t.title} → ${p.members.find((m) => m.id === c.to)?.name}`,
      `${p.members.find((m) => m.id === c.from)?.name ?? '未分配'}交接。${c.reason} 原有成果貢獻保留。`,
    );
  }
  if (!r.changes.length)
    log(
      p,
      '分工檢查完成',
      r.warnings.length
        ? '目前無法透過現有人力解決所有風險，請調整範圍或期限。'
        : '現有分工仍適合，不需要更動。',
    );
  for (const s of r.slots) {
    const t = p.tasks.find((t) => t.id === s.taskId)!;
    if (Number.isFinite(s.end)) t.due = addDays(day(), Math.ceil(s.end));
  }
  p.lastCheck = new Date().toISOString();
  return r;
}
