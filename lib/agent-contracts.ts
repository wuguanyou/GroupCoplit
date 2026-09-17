import { AgentError } from './ai-provider.ts';
export const kinds = ['plan', 'report', 'rebalance', 'analysis'] as const;
export type AgentKind = (typeof kinds)[number];
const str = { type: 'string' };
const list = { type: 'array', items: str };
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
export const schemas: Record<AgentKind, Record<string, unknown>> = {
  plan: obj({
    summary: str,
    questions: list,
    tasks: {
      type: 'array',
      items: obj({
        key: str,
        title: str,
        skill: str,
        hours: { type: 'number' },
        difficulty: { type: 'integer' },
        deps: list,
        criteria: str,
      }),
    },
  }),
  report: obj({
    summary: str,
    remainingHours: { type: ['number', 'null'] },
    availableDate: { type: ['string', 'null'] },
    questions: list,
  }),
  rebalance: obj({
    summary: str,
    questions: list,
    assignments: {
      type: 'array',
      items: obj({ taskId: str, memberId: str, reason: str }),
    },
  }),
  analysis: obj({
    summary: str,
    risks: list,
    suggestions: list,
    contributionNotes: list,
    questions: list,
  }),
};
export type PlanTask = {
  key: string;
  title: string;
  skill: string;
  hours: number;
  difficulty: number;
  deps: string[];
  criteria: string;
};
export type AgentResult = {
  summary: string;
  questions: string[];
  tasks?: PlanTask[];
  remainingHours?: number | null;
  availableDate?: string | null;
  assignments?: { taskId: string; memberId: string; reason: string }[];
  risks?: string[];
  suggestions?: string[];
  contributionNotes?: string[];
};
export function object(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== 'object' || Array.isArray(x))
    throw new AgentError('資料必須為物件');
  return x as Record<string, unknown>;
}
export function text(x: unknown, max = 2000) {
  if (typeof x !== 'string' || !x.trim() || x.length > max)
    throw new AgentError('文字欄位缺漏或過長');
  return x.trim();
}
export function number(x: unknown, min: number, max: number) {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < min || x > max)
    throw new AgentError('工時或難度超出範圍');
  return x;
}
const strings = (x: unknown, max = 20) => {
  if (!Array.isArray(x) || x.length > max)
    throw new AgentError('清單格式不正確');
  return x.map((v) => text(v));
};
export function validDate(x: unknown) {
  const d = text(x, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
    Number.isNaN(Date.parse(d)) ||
    new Date(d).toISOString().slice(0, 10) !== d
  )
    throw new AgentError('日期格式無效');
  return d;
}
export function validateResult(kind: AgentKind, value: unknown): AgentResult {
  const v = object(value);
  const allowed = Object.keys(schemas[kind].properties as object);
  if (
    Object.keys(v).some((k) => !allowed.includes(k)) ||
    allowed.some((k) => !(k in v))
  )
    throw new AgentError('AI 回傳欄位不符合約定');
  const result: AgentResult = {
    summary: text(v.summary),
    questions: strings(v.questions, 10),
  };
  if (kind === 'plan') {
    if (!Array.isArray(v.tasks) || v.tasks.length > 15)
      throw new AgentError('每次最多拆解 15 項任務');
    result.tasks = v.tasks.map((x) => {
      const t = object(x);
      if (
        Object.keys(t).some(
          (k) =>
            ![
              'key',
              'title',
              'skill',
              'hours',
              'difficulty',
              'deps',
              'criteria',
            ].includes(k),
        )
      )
        throw new AgentError('任務包含未允許欄位');
      const difficulty = number(t.difficulty, 1, 3);
      if (!Number.isInteger(difficulty)) throw new AgentError('難度必須是整數');
      return {
        key: text(t.key, 80),
        title: text(t.title, 120),
        skill: text(t.skill, 30),
        hours: number(t.hours, 0.5, 80),
        difficulty,
        deps: strings(t.deps, 30),
        criteria: text(t.criteria, 500),
      };
    });
  }
  if (kind === 'report') {
    result.remainingHours =
      v.remainingHours === null ? null : number(v.remainingHours, 0.5, 80);
    result.availableDate =
      v.availableDate === null ? null : validDate(v.availableDate);
  }
  if (kind === 'rebalance') {
    if (!Array.isArray(v.assignments) || v.assignments.length > 30)
      throw new AgentError('分工清單過長');
    result.assignments = v.assignments.map((x) => {
      const a = object(x);
      if (
        Object.keys(a).some(
          (k) => !['taskId', 'memberId', 'reason'].includes(k),
        )
      )
        throw new AgentError('分工包含未允許欄位');
      return {
        taskId: text(a.taskId, 80),
        memberId: text(a.memberId, 80),
        reason: text(a.reason, 500),
      };
    });
  }
  if (kind === 'analysis') {
    result.risks = strings(v.risks);
    result.suggestions = strings(v.suggestions);
    result.contributionNotes = strings(v.contributionNotes);
  }
  return result;
}
