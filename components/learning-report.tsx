'use client';
import { Download } from 'lucide-react';
import { learningMarkdown, learningRows } from '../lib/learning-report';
import type { Project } from '../lib/project';

export function LearningReport({ project }: { project: Project }) {
  function download() {
    const url = URL.createObjectURL(new Blob([learningMarkdown(project)], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'GroupPilot-團隊學習報告.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="panel" style={{ marginBottom: 24 }}>
    <div className="panel-title">
      <div><h2>團隊學習回饋</h2><p>依驗收證據整理實作與下一步，供組員反思、老師討論；不作為自動評分。</p></div>
      <button type="button" className="btn" onClick={download}><Download size={16} />下載學習報告</button>
    </div>
    <div className="file-grid">{learningRows(project).map((r) => <article className="file-card" key={r.member.id}>
      <h3>{r.member.name}</h3>
      <p>已驗收 {r.accepted} · 待驗收 {r.pending} · 退回 {r.rejected}</p>
      <p>實作涉及：{r.skills.join('、') || '尚無已驗收證據'}</p>
      <p>{r.feedback}</p>
    </article>)}</div>
    <p className="file-help">此區由規則整理，不是 AI 生成評語。下載內容包含團隊姓名與成果說明，分享前請確認對象。</p>
  </section>;
}
