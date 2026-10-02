import { access, owner, apiError, AccessError } from '../../../lib/access';
import { validateAttachments } from '../../../db/files';
import { readProject, saveProject } from '../../../db/store';
import { aiReady, aiStatus } from '../../../lib/ai';
import { addDeadlineReminders } from '../../../lib/reminders';
import {
  analyze,
  contributions,
  day,
  log,
  replan,
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
    const identity = await access();
    const { project, revision } = await readProject();
    return Response.json(
      {
        project,
        currentUserId: identity.user.userId,
        role: identity.role,
        revision,
        analysis: analyze(project),
        contributions: contributions(project),
        aiConnected: aiReady(),
        aiStatus: aiStatus(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
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
    const identity = await access();
    if (['project', 'task', 'auto', 'replan', 'reminders', 'taskDeadline'].includes(String(b.action)))
      owner(identity.role);
    if (
      ['report', 'evidence', 'review'].includes(String(b.action)) &&
      b.memberId !== identity.user.userId
    )
      throw new AccessError('只能以自己的身分提交或驗收');
    if (b.action === 'member' && b.memberId !== identity.user.userId)
      owner(identity.role);
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
      case 'reminders':
        if(typeof b.enabled!=='boolean') throw Error('提醒設定無效');
        p.remindersEnabled=b.enabled;
        log(p,'到期提醒設定',b.enabled?'已啟用站內與聊天室提醒；每天 09:00 至 21:00 之間檢查，同任務同人每天最多一次。':'已停用到期提醒');
        addDeadlineReminders(p,new Date().toISOString());
        break;
      case 'taskDeadline':
        task().due=date(b.due);
        log(p,'任務截止日更新',`${task().title}：${task().due}`);
        break;
      case 'notificationRead': {
        const ids=Array.isArray(b.ids)?b.ids:[];
        for(const item of p.notifications ?? []) if(item.memberId===identity.user.userId && ids.includes(item.id)) item.readAt=new Date().toISOString();
        break;
      }
      case 'comment': {
        const t=task();
        const id=text(b.requestId,80);
        if((p.taskComments??[]).some(c=>c.id===id && c.memberId===identity.user.userId)) break;
        const body=text(b.body,2000);
        const at=new Date().toISOString();
        const mentions=Array.isArray(b.mentions)?[...new Set(b.mentions)]:[];
        if(mentions.some(id=>!p.members.some(m=>m.id===id)))throw Error('提及的成員無效');
        p.taskComments=[...(p.taskComments??[]),{id,taskId:t.id,memberId:identity.user.userId,body,createdAt:at}].slice(-1000);
        for(const memberId of mentions) if(memberId!==identity.user.userId) {
          p.notifications=[...(p.notifications??[]),{id:`mention:${id}:${identity.user.userId}:${memberId}`,taskId:t.id,memberId:memberId as string,kind:'mention' as const,body:`${p.members.find(m=>m.id===identity.user.userId)?.name??'組員'} 在「${t.title}」留言提及你：${body}`,createdAt:at}].slice(-500);
        }
        break;
      }
      case 'replan':
        replan(p);
        break;
      case 'check': {
        if (Date.now() - Date.parse(p.lastCheck) < 60000)
          return Response.json({ ok: true });
        const r = analyze(p);
        p.lastCheck = new Date().toISOString();
        addDeadlineReminders(p,p.lastCheck);
        if (r.risks.length) {
          const signature = r.risks.map((x) => x.title).join('；');
          if (
            !p.events.some(
              (e) =>
                e.kind === 'risk' &&
                e.detail === signature &&
                day(new Date(e.at)) === day(),
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
        if (t.status === 'review') throw Error('任務正在驗收，退回後才能修改進度');
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
          fileIds: await validateAttachments(b.fileIds, t.id, identity),
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
        throw new AccessError('真實專案不提供示範重設', 400);
      default:
        throw Error('不支援的操作');
    }
    await saveProject(p, stored.revision);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AccessError) return apiError(error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : '操作失敗，請稍後重試',
      },
      { status: 400 },
    );
  }
}
