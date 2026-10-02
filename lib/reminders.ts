import { day, type Project } from './project.ts';
export function addDeadlineReminders(p: Project, at: string) {
  if (!p.remindersEnabled || p.demo) return 0;
  const date=day(new Date(at));
  const hour=(new Date(at).getUTCHours()+8)%24;
  if(hour<9 || hour>=21) return 0;
  const items=p.notifications ??= [];
  let added=0;
  for(const task of p.tasks) {
    if(task.status==='done' || task.status==='review' || !task.owner) continue;
    const owner=p.members.find(m=>m.id===task.owner);if(!owner) continue;
    const days=(Date.parse(task.due+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000;
    if(!Number.isFinite(days) || days>1) continue;
    const id=`deadline:${task.id}:${task.owner}:${task.due}:${date}`;
    if(items.some(n=>n.id===id)) continue;
    const impact=p.tasks.filter(t=>t.status!=='done' && t.deps.includes(task.id)).map(t=>t.title);
    const timing=days<0?`已逾期 ${-days} 天`:days===0?'今天到期':'明天到期';
    items.push({id,taskId:task.id,memberId:owner.id,kind:'reminder',createdAt:at,body:`${owner.name}，任務「${task.title}」${timing}（截止 ${task.due}）。請提交成果或回報目前進度。${impact.length?`後續受影響任務：${impact.join('、')}。`:''}`});added++;
  }
  p.notifications=items.slice(-500);
  return added;
}
