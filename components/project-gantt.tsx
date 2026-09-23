'use client';
import { useState } from 'react';
import { analyze, addDays, day, type Project } from '../lib/project';

export function ProjectGantt({ project }: { project: Project }) {
  const [owner, setOwner] = useState('');
  const today = day();
  const plan = analyze(project, today);
  const finite = plan.slots.filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end));
  const days = Math.max(7, Math.ceil(Math.max(0, ...finite.map((s) => s.end))));
  const visible = project.tasks.filter((t) => !owner || t.owner === owner);
  return <section className="panel gantt-panel">
    <div className="panel-title"><div><h2>預估進度甘特圖</h2><p>從今天起，依剩餘工時、每日可用時間與前置任務計算。長條是預估排程，不是實際工作紀錄。</p></div>
      <label>負責人 <select value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">全部組員</option>{project.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    </div>
    <p>專案截止：{project.deadline} · 預估完成：{plan.finishDate ?? '目前無法完成排程'}</p>
    <div className="gantt-scroll" tabIndex={0} role="region" aria-label="任務甘特圖，可水平捲動">
      <div className="gantt-table">
        <div className="gantt-row"><strong>任務／依賴</strong><div className="gantt-scale"><span>{today}</span><span>{addDays(today, Math.ceil(days / 2))}</span><span>{addDays(today, days)}</span></div></div>
        {visible.map((t) => {
          const slot = finite.find((s) => s.taskId === t.id);
          const member = project.members.find((m) => m.id === t.owner);
          const label = t.status === 'done' ? '已完成' : !slot ? '無法排程：請確認技能、可用時間及前置任務' : `${addDays(today, Math.floor(slot.start))} ～ ${addDays(today, Math.ceil(slot.end))}`;
          return <div className="gantt-row" key={t.id}><div><strong>{t.title}</strong><small>{member?.name ?? '未分配'} · 截止 {t.due}</small><small>前置：{t.deps.map((id) => project.tasks.find((x) => x.id === id)?.title ?? '未知任務').join('、') || '無'}</small></div>
            <div className="gantt-track" aria-label={`${t.title}：${label}`}>
              {slot && t.status !== 'done' ? <div className="gantt-bar" title={`${t.title}：${label}`} style={{left:`${slot.start / days * 100}%`,width:`${Math.max(.4, (slot.end-slot.start) / days * 100)}%`}} /> : null}
              <span>{label}</span>
            </div></div>;
        })}
        {!visible.length && <p>目前沒有符合條件的任務。建立任務後即可產生排程。</p>}
      </div>
    </div>
  </section>;
}
