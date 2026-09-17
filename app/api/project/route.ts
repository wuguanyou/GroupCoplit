import { readProject, saveProject } from '../../../db/store';
import { aiReady, aiStatus } from '../../../lib/ai';
import {
  analyze,
  contributions,
  day,
  log,
  replan,
  seed,
  skillNames,
  type Evidence,
} from '../../../lib/project';
const text = (x: unknown, max = 2000) => {
  if (typeof x !== 'string' || !x.trim() || x.length > max)
    throw Error('請填寫有效文字');
  return x.trim();
};
const num = (x: unknown, min: number, max: number) => {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < min || x > max)
    throw Error('數值超出允許範圍');
  return x;
};
const date = (x: unknown) => {
  const v = text(x, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    Number.isNaN(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    throw Error('日期格式錯誤');
  return v;
};
export async function GET() {
  try {
    const { project, revision } = await readProject();
    return Response.json(
      {
        project,
        revision,
        analysis: analyze(project),
        contributions: contributions(project),
        aiConnected: aiReady(),
        aiStatus: aiStatus(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { error: '專案資料尚未準備完成，請稍後重試。' },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      return Response.json({ error: '來源不符' }, { status: 403 });
    const input = await request.json();
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw Error('請提供有效操作物件');
    const b = input as Record<string, unknown>;
    const stored = await readProject();
    let p = stored.project;
    if (b.revision !== stored.revision)
      return Response.json(
        { error: '資料已更新，請重新載入再試。' },
        { status: 409 },
      );
    const member = () => {
      const m = p.members.find((m) => m.id === b.memberId);
      if (!m) throw Error('找不到組員');
      return m;
    };
    const task = () => {
      const t = p.tasks.find((t) => t.id === b.taskId);
      if (!t) throw Error('找不到任務');
      return t;
    };
    switch (b.action) {
      case 'replan':
        replan(p);
        break;
      case 'check': {
        if (Date.now() - Date.parse(p.lastCheck) < 60000)
          return Response.json({ ok: true });
        const r = analyze(p);
        p.lastCheck = new Date().toISOString();
        if (r.risks.length) {
          const signature = r.risks.map((x) => x.title).join('；');
          if (
            !p.events.some(
              (e) =>
                e.kind === 'risk' &&
                e.detail === signature &&
                e.at.slice(0, 10) === day(),
            )
          )
            log(p, '偵測到需要處理的風險', signature, 'risk');
          if (p.auto) replan(p);
        }
        break;
      }
      case 'auto':
        if (typeof b.enabled !== 'boolean') throw Error('設定無效');
        p.auto = b.enabled;
        log(
          p,
          '自動分工設定',
          p.auto
            ? '組員回報與定時檢查後，自動評估與調整。'
            : '改為手動執行重新分工。',
        );
        break;
      case 'member': {
        const m = member();
        m.dailyHours = num(b.dailyHours, 0, 8);
        m.unavailableUntil = date(b.unavailableUntil);
        m.preference = text(b.preference, 30);
        if (
          !Array.isArray(b.skills) ||
          !b.skills.length ||
          b.skills.some((s: unknown) => typeof s !== 'string' || !skillNames[s])
        )
          throw Error('請至少選擇一項有效技能');
        m.skills = [...new Set(b.skills)] as string[];
        if (!m.skills.includes(m.preference)) m.preference = m.skills[0];
        log(
          p,
          `${m.name} 更新可用時間`,
          `${m.dailyHours} 小時／日；可開始日期 ${m.unavailableUntil}。`,
          'report',
        );
        if (p.auto) replan(p);
        break;
      }
      case 'report': {
        const m = member();
        const t = task();
        if (t.owner !== m.id) throw Error('請選擇任務目前的負責人');
        if (t.status === 'done') throw Error('已完成任務不能修改剩餘工時');
        const note = text(b.note);
        t.hours = num(b.remainingHours, 0.5, 80);
        m.unavailableUntil = date(b.unavailableUntil);
        log(
          p,
          `${m.name} 回報：${t.title}`,
          `${note}；剩餘 ${t.hours} 小時，${m.unavailableUntil} 起可工作。`,
          'report',
        );
        if (p.auto) replan(p);
        break;
      }
      case 'evidence': {
        const m = member();
        const t = task();
        const kind = b.kind === 'support' ? 'support' : 'delivery';
        if (kind === 'delivery' && t.status === 'done')
          throw Error('成果已驗收完成，請使用協作紀錄');
        const url = typeof b.url === 'string' ? b.url.trim() : '';
        if (url && (!/^https?:\/\//i.test(url) || url.length > 2000))
          throw Error('成果連結需為 http 或 https');
        const e: Evidence = {
          id: crypto.randomUUID(),
          taskId: t.id,
          memberId: m.id,
          kind,
          hours: num(b.hours, 0.25, 80),
          note: text(b.note),
          url,
          status: 'pending',
          reviewer: '',
          createdAt: new Date().toISOString(),
        };
        p.evidence.push(e);
        if (kind === 'delivery') t.status = 'review';
        log(
          p,
          `${m.name} 提交${kind === 'delivery' ? '成果' : '協作紀錄'}`,
          `${t.title}：${e.note}`,
          'evidence',
        );
        break;
      }
      case 'review': {
        const e = p.evidence.find((e) => e.id === b.evidenceId);
        if (!e || e.status !== 'pending') throw Error('找不到待驗收成果');
        const reviewer = member();
        if (reviewer.id === e.memberId) throw Error('需由另一位組員驗收');
        if (typeof b.accept !== 'boolean') throw Error('驗收結果無效');
        const t = p.tasks.find((t) => t.id === e.taskId)!;
        if (
          b.accept &&
          e.kind === 'delivery' &&
          t.deps.some(
            (id) => p.tasks.find((x) => x.id === id)?.status !== 'done',
          )
        )
          throw Error('請先完成前置任務的驗收');
        e.status = b.accept ? 'accepted' : 'rejected';
        e.reviewer = reviewer.id;
        if (e.kind === 'delivery') {
          t.status = p.evidence.some(
            (x) =>
              x.taskId === t.id &&
              x.kind === 'delivery' &&
              x.status === 'accepted',
          )
            ? 'done'
            : p.evidence.some(
                  (x) =>
                    x.taskId === t.id &&
                    x.status === 'pending' &&
                    x.kind === 'delivery',
                )
              ? 'review'
              : 'doing';
        }
        log(
          p,
          `${reviewer.name}${b.accept ? '通過' : '退回'}驗收`,
          `${t.title}：${e.note}`,
          'evidence',
        );
        if (p.auto && b.accept) replan(p);
        break;
      }
      case 'task': {
        const title = text(b.title, 120);
        const skill = text(b.skill, 30);
        if (!skillNames[skill]) throw Error('技能無效');
        const deps = Array.isArray(b.deps) ? b.deps : [];
        if (deps.some((id: unknown) => !p.tasks.some((t) => t.id === id)))
          throw Error('前置任務無效');
        p.tasks.push({
          id: crypto.randomUUID(),
          title,
          skill,
          hours: num(b.hours, 0.5, 80),
          estimate: num(b.hours, 0.5, 80),
          difficulty: num(b.difficulty, 1, 3),
          deps,
          owner: '',
          status: 'todo',
          due: p.deadline,
          criteria: text(b.criteria, 500),
        });
        log(p, '新增需求', title);
        if (p.auto) replan(p);
        break;
      }
      case 'project':
        p.name = text(b.name, 100);
        p.requirements = text(b.requirements, 12000);
        p.deadline = date(b.deadline);
        log(p, '專案要求已更新', p.name);
        if (p.auto) replan(p);
        break;
      case 'reset':
        if (b.confirm !== 'RESET') throw Error('需要確認');
        p = seed();
        break;
      default:
        throw Error('不支援的操作');
    }
    await saveProject(p, stored.revision);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : '操作失敗，請稍後重試',
      },
      { status: 400 },
    );
  }
}
