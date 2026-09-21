import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../lib/project.ts';
import { learningRows, learningMarkdown } from '../lib/learning-report.ts';

test('learning feedback only attributes skills from accepted evidence, including former owners', () => {
  const p = seed();
  const e = p.evidence[0];
  p.evidence = [{ ...e, status: 'pending' }];
  assert.deepEqual(learningRows(p).find((r) => r.member.id === e.memberId).skills, []);
  p.evidence[0].status = 'accepted';
  p.tasks.find((t) => t.id === e.taskId).owner = 'different-owner';
  assert.equal(learningRows(p).find((r) => r.member.id === e.memberId).tasks.length, 1);
});
test('export labels demo and self reports, escapes active Markdown, and preserves project', () => {
  const p = seed();
  p.name = '<script>alert(1)</script>';
  p.evidence[0].note = '[click](https://example.com)';
  const before = structuredClone(p);
  const report = learningMarkdown(p, '2026-09-21T00:00:00Z');
  assert.ok(report.includes('示範資料'));
  assert.ok(report.includes('不等同已驗證工時'));
  assert.ok(!report.includes('<script>'));
  assert.ok(!report.includes('[click]('));
  assert.deepEqual(p, before);
});
