'use client';
import {useState} from 'react';
import type {Project,Task} from '../lib/project';
type Props={project:Project; userId:string; role:string; busy:boolean; perform:(action:string,values:Record<string,unknown>)=>Promise<unknown>; onReport:(task:Task)=>void; onSubmit:(task:Task)=>void};
export function NotificationCenter({project:p,userId,role,busy,perform,onReport,onSubmit}:Props) {
  const [error,setError]=useState('');
  const items=(p.notifications??[]).filter(n=>n.memberId===userId).slice().reverse();
  const run=(action:string,values:Record<string,unknown>)=>{setError('');perform(action,values).catch(e=>setError(e.message));};
  return <section className="panel"><h2>通知與到期提醒</h2><p>到期前一天、到期當天及逾期後提醒。每天 09:00 至 21:00（台灣時間）檢查，同任務同負責人每天最多一次；提交待驗收或完成後停止催繳。</p>
    {role==='owner' ? <label><input type="checkbox" checked={!!p.remindersEnabled} disabled={busy} onChange={e=>run('reminders',{enabled:e.target.checked})}/> 啟用團隊站內與聊天室到期提醒</label> : <p>到期提醒：{p.remindersEnabled?'已啟用':'尚未啟用，請聯絡專案建立者'}</p>}
    {error&&<p role="alert">{error}</p>}
    {items.some(n=>!n.readAt)&&<button className="btn" disabled={busy} onClick={()=>run('notificationRead',{ids:items.filter(n=>!n.readAt).map(n=>n.id)})}>全部標為已讀</button>}
    {!items.length&&<p>目前沒有你的通知。</p>}
    <div className="collaboration-list">{items.map(n=>{const task=p.tasks.find(t=>t.id===n.taskId);return <article className="collaboration-item" key={n.id}><small>{n.readAt?'已讀':'未讀'} · {new Date(n.createdAt).toLocaleString('zh-TW')}</small><p>{n.body}</p><div className="actions">{!n.readAt&&<button className="btn" disabled={busy} onClick={()=>run('notificationRead',{ids:[n.id]})}>標為已讀</button>}{task&&task.owner===userId&&['todo','doing'].includes(task.status)&&<><button className="btn" onClick={()=>onReport(task)}>回報進度</button><button className="btn" onClick={()=>onSubmit(task)}>提交成果</button></>}</div></article>;})}</div>
  </section>;
}
export function TaskDiscussion({project:p,userId,role,busy,perform}:Props) {
  const [selectedTask,setTaskId]=useState(p.tasks[0]?.id??'');
  const taskId=p.tasks.some(t=>t.id===selectedTask)?selectedTask:(p.tasks[0]?.id??'');
  const [body,setBody]=useState('');const [mention,setMention]=useState('');const [error,setError]=useState('');
  const [due,setDue]=useState('');const [nonce,setNonce]=useState('');
  const task=p.tasks.find(t=>t.id===taskId);
  const comments=(p.taskComments??[]).filter(c=>c.taskId===taskId);
  async function send(e:React.FormEvent){e.preventDefault();setError('');const id=nonce||crypto.randomUUID();setNonce(id);try{await perform('comment',{taskId,body,requestId:id,mentions:mention?[mention]:[]});setBody('');setMention('');setNonce('');}catch(e){setError((e as Error).message);}}
  return <section className="panel"><h2>任務討論與截止日</h2>{!p.tasks.length?<p>建立任務後，就能留言與設定個別截止日。</p>:<>
    <label>討論任務 <select value={taskId} onChange={e=>{setTaskId(e.target.value);setBody('');setNonce('');setDue('');}}>{p.tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
    {role==='owner'&&task&&<div className="actions"><label>任務截止日 <input type="date" value={due||task.due} onChange={e=>setDue(e.target.value)}/></label><button className="btn" disabled={busy||!due} onClick={()=>{setError('');perform('taskDeadline',{taskId,due}).then(()=>setDue('')).catch(e=>setError(e.message));}}>儲存截止日</button></div>}
    {error&&<p role="alert">{error}</p>}
    <div className="collaboration-list">{comments.length?comments.map(c=><article className="collaboration-item" key={`${c.memberId}:${c.id}`}><strong>{p.members.find(m=>m.id===c.memberId)?.name??'組員'}</strong><small> · {new Date(c.createdAt).toLocaleString('zh-TW')}</small><p>{c.body}</p></article>):<p>這項任務還沒有留言。</p>}</div>
    <form className="chat-compose" onSubmit={send}><label>任務留言<textarea required value={body} maxLength={2000} disabled={busy} onChange={e=>{setBody(e.target.value);setNonce('');}} placeholder="討論需求、卡關原因或交付內容…"/></label><label>提及組員 <select value={mention} disabled={busy} onChange={e=>{setMention(e.target.value);setNonce('');}}><option value="">不提及</option>{p.members.filter(m=>m.id!==userId).map(m=><option value={m.id} key={m.id}>@{m.name}</option>)}</select></label><button className="btn primary" disabled={busy||!body.trim()}>送出留言</button></form>
  </>}</section>;
}
