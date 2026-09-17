import {
  addDays,
  day,
  log,
  ordered,
  replan,
  schedule,
  skillNames,
  type Project,
} from './project.ts';
import { AgentError } from './ai-provider.ts';
import {
  validateResult,
  type AgentKind,
  type AgentResult,
} from './agent-contracts.ts';
export type AgentInput = { note: string; taskId?: string };
export function prepareAction(
  project: Project,
  kind: AgentKind,
  raw: unknown,
  input: AgentInput,
  runId: string,
  today = day(),
): {
  project: Project;
  changes: string[];
  result: AgentResult;
  needsClarification: boolean;
} {
  const result = validateResult(kind, raw);
  const p = structuredClone(project);
  const changes: string[] = [];
  if (kind === 'analysis')
    return { project: p, changes, result, needsClarification: false };
  if (result.questions.length)
    return { project: p, changes, result, needsClarification: true };
  if (kind === 'plan') {
    const tasks = result.tasks!;
    if (!tasks.length) throw new AgentError('AI 沒有產生任務，請補充需求');
    if (p.tasks.length + tasks.length > 150)
      throw new AgentError('此原型每個專案最多 150 項任務');
    const ids = new Map<string, string>();
    const titles = new Set(
      p.tasks.map((t) => t.title.toLocaleLowerCase().trim()),
    );
    tasks.forEach((t, i) => {
      if (ids.has(t.key) || p.tasks.some((x) => x.id === t.key))
        throw new AgentError('新任務識別碼重複');
      if (titles.has(t.title.toLocaleLowerCase()))
        throw new AgentError('AI 產生重複任務，請縮小需求範圍');
      titles.add(t.title.toLocaleLowerCase());
      if (!Object.hasOwn(skillNames, t.skill))
        throw new AgentError('AI 使用了不存在的技能');
      if (
        !p.members.some((m) => m.skills.includes(t.skill) && m.dailyHours > 0)
      )
        throw new AgentError(`${t.title} 缺乏可接手的技能或工時`);
      ids.set(t.key, `${runId}-${i}`);
    });
    for (const t of tasks) {
      const deps = t.deps.map((key) => ids.get(key) ?? key);
      p.tasks.push({
        id: ids.get(t.key)!,
        title: t.title,
        skill: t.skill,
        hours: t.hours,
        estimate: t.hours,
        difficulty: t.difficulty,
        deps,
        owner: '',
        status: 'todo',
        due: p.deadline,
        criteria: t.criteria,
      });
      changes.push(
        `新增「${t.title}」：${t.hours} 小時，${skillNames[t.skill]}`,
      );
    }
    ordered(p.tasks);
    replan(p);
    const feasible = schedule(p);
    if (feasible.warnings.length)
      throw new AgentError(
        '新任務無法在目前人力與期限內完成，請縮小範圍後重新分析。',
      );
  }
  if (kind === 'report') {
    const t = p.tasks.find((t) => t.id === input.taskId);
    if (!t || t.status === 'done' || t.status === 'review')
      throw new AgentError('此任務不適合更新進度');
    const m = p.members.find((m) => m.id === t.owner);
    if (!m) throw new AgentError('任務尚未分配');
    if (result.remainingHours == null || result.availableDate == null)
      return { project: p, changes, result, needsClarification: true };
    if (result.availableDate < today)
      throw new AgentError('可工作日期已過，請重新回報');
    t.hours = result.remainingHours;
    m.unavailableUntil = result.availableDate;
    log(
      p,
      `${m.name} 的 AI 解析回報`,
      `${input.note}；剩餘 ${t.hours} 小時，${m.unavailableUntil} 起可工作。`,
      'report',
    );
    changes.push(
      `${t.title} 剩餘 ${t.hours} 小時；${m.name} ${m.unavailableUntil} 起可工作`,
    );
    if (p.auto) {
      const r = replan(p);
      changes.push(
        ...r.changes.map(
          (c) =>
            `${p.tasks.find((t) => t.id === c.taskId)?.title} → ${p.members.find((m) => m.id === c.to)?.name}`,
        ),
      );
      if (r.warnings.length)
        changes.push('仍有期限或人力風險，請查看專案總覽。');
    }
  }
  if (kind === 'rebalance') {
    const seen = new Set<string>();
    const before = schedule(p).duration;
    for (const a of result.assignments!) {
      if (seen.has(a.taskId)) throw new AgentError('同一任務不能重複分工');
      seen.add(a.taskId);
      const t = p.tasks.find((t) => t.id === a.taskId);
      const m = p.members.find((m) => m.id === a.memberId);
      if (!t || !m) throw new AgentError('AI 引用了不存在的任務或組員');
      if (t.status === 'done' || t.status === 'review')
        throw new AgentError('不能轉交已完成或待驗收任務');
      if (!m.skills.includes(t.skill) || m.dailyHours <= 0)
        throw new AgentError('接手者技能或可投入時間不符');
      if (t.owner !== m.id) {
        t.owner = m.id;
        changes.push(`${t.title} → ${m.name}：${a.reason}`);
      }
    }
    const after = schedule(p);
    if (
      !Number.isFinite(after.duration) ||
      after.duration + changes.length * 0.5 > before + 0.001
    )
      throw new AgentError(
        'AI 分工未改善排程（已計入每次轉交半天緩衝），保留原分工。',
      );
    for (const slot of after.slots) {
      p.tasks.find((t) => t.id === slot.taskId)!.due = addDays(
        today,
        Math.ceil(slot.end + changes.length * 0.5),
      );
    }
    if (!changes.length) changes.push('維持現有分工');
  }
  log(
    p,
    'AI 工具執行完成',
    `${kind}｜${result.summary}｜${changes.join('；')}`,
  );
  return { project: p, changes, result, needsClarification: false };
}
