import { contributions, skillNames, type Project } from './project.ts';

export function learningRows(project: Project) {
  return contributions(project).map((c) => {
    const evidence = project.evidence.filter((e) => e.memberId === c.member.id);
    const accepted = evidence.filter((e) => e.status === 'accepted');
    const tasks = project.tasks.filter((t) => accepted.some((e) => e.taskId === t.id));
    const rejected = evidence.filter((e) => e.status === 'rejected').length;
    return {
      ...c,
      rejected,
      tasks,
      skills: [...new Set(tasks.map((t) => skillNames[t.skill] ?? t.skill))],
      feedback: rejected
        ? '先依驗收意見修正退回成果，補充修改說明後重新提交。'
        : c.pending
          ? '邀請另一位組員驗收待審成果，確認是否符合任務驗收標準。'
          : !accepted.length
            ? '尚無已驗收成果；可提交實作或協作紀錄，不能據此判定沒有付出。'
            : '整理一次實作反思：完成了什麼、遇到什麼困難、下次如何改進。',
    };
  });
}

// User-authored text stays plain text when the report is rendered as Markdown.
const safe = (value: string) => value.replace(/[\r\n]+/g, ' ').replace(/[\\`*_{}\[\]()<>#+.!|~-]/g, '\\$&');
export function learningMarkdown(project: Project, generatedAt = new Date().toISOString()) {
  const names = new Map(project.members.map((m) => [m.id, m.name]));
  return [
    `# ${safe(project.name)}｜團隊學習與貢獻報告`,
    `產生時間：${generatedAt}　截止日：${safe(project.deadline)}`,
    '本報告由目前專案紀錄與規則計算產生，不是生成式 AI 評語，也不是教師成績。技能表示已有相關實作證據，不代表能力測驗結果。',
    project.demo ? '**資料模式：示範資料，不代表真實學生的成果。**' : '資料模式：目前團隊專案紀錄。',
    '## 專案要求', safe(project.requirements),
    '## 成果摘要',
    `任務 ${project.tasks.length} 項；完成 ${project.tasks.filter((t) => t.status === 'done').length} 項；已驗收紀錄 ${project.evidence.filter((e) => e.status === 'accepted').length} 筆。`,
    ...learningRows(project).flatMap((r) => [
      `## ${safe(r.member.name)}`,
      `已驗收 ${r.accepted} 筆／待驗收 ${r.pending} 筆／退回 ${r.rejected} 筆；貢獻點數 ${r.score}，占比 ${r.share}%。`,
      `申報工時（含未驗收與退回）：${r.hours} 小時。此數值不等同已驗證工時。`,
      `已驗收實作涉及：${r.skills.length ? r.skills.map(safe).join('、') : '尚無足夠證據'}`,
      `下一步：${r.feedback}`,
      ...project.evidence.filter((e) => e.memberId === r.member.id).map((e) => {
        const task = project.tasks.find((t) => t.id === e.taskId);
        const status = { accepted: '已驗收', pending: '待驗收', rejected: '已退回' }[e.status];
        return `- ${safe(task?.title ?? '任務不存在')}｜${status}｜${e.kind === 'support' ? '協作' : '交付'}｜驗收者：${safe(names.get(e.reviewer) ?? '尚無')}｜附件 ${(e.fileIds ?? []).length} 個\n  ${safe(e.note)}`;
      }),
    ]),
    '## 計算方式與限制',
    '只以已驗收紀錄分配貢獻點數；任務交付點數上限為預估工時 × 難度，協作上限為其 25%。同任務、同類別按已驗收紀錄的申報工時比例分配，重複提交不增加任務總點數。工時仍是自報資料，需由組員與教師檢視。',
    '## 生成式 AI 在系統中的用途',
    'AI 用於提出任務拆解、解析自然語言進度回報、提出重新分工與風險分析。依賴檢查、權限、排程及貢獻分數由程式驗證與計算。本報告不宣稱這個專案已實際執行上述 AI 操作；實際執行請對照 AI 代理紀錄。',
  ].join('\n\n');
}
