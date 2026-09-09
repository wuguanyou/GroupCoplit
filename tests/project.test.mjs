import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seed,
  schedule,
  replan,
  contributions,
  ordered,
  day,
  addDays,
} from '../lib/project.ts';
test('a blocked member triggers a skill-compatible handoff; completed authors stay intact', () => {
  const p = seed();
  p.members[2].unavailableUntil = addDays(day(), 7);
  const original = JSON.stringify(p.evidence);
  const r = replan(p);
  assert.ok(r.changes.some((c) => c.taskId === 't4' && c.to === 'm4'));
  assert.equal(JSON.stringify(p.evidence), original);
  for (const c of r.changes) {
    const t = p.tasks.find((t) => t.id === c.taskId);
    assert.ok(p.members.find((m) => m.id === c.to).skills.includes(t.skill));
  }
});
test('dependencies and member capacity cannot overlap', () => {
  const p = seed();
  const { slots } = schedule(p, true);
  for (const s of slots) {
    const task = p.tasks.find((t) => t.id === s.taskId);
    for (const id of task.deps) {
      const dep = slots.find((x) => x.taskId === id);
      if (dep) assert.ok(s.start >= dep.end);
    }
    const siblings = slots.filter(
      (x) => x.owner === s.owner && x.taskId !== s.taskId,
    );
    for (const other of siblings)
      assert.ok(s.end <= other.start || other.end <= s.start);
  }
});
test('zero availability reports an infeasible plan', () => {
  const p = seed();
  p.members.forEach((m) => (m.dailyHours = 0));
  const r = schedule(p, true);
  assert.equal(r.finishDate, null);
  assert.ok(r.warnings.length > 0);
});
test('cycles are rejected', () => {
  const p = seed();
  p.tasks[0].deps = ['t11'];
  assert.throws(() => ordered(p.tasks), /循環/);
});
test('contribution budget stays capped and is independent of remaining hours', () => {
  const p = seed();
  const before = contributions(p).reduce((s, c) => s + c.score, 0);
  const t = p.tasks[0];
  t.hours = 50;
  p.evidence.push({
    ...p.evidence[0],
    id: 'another',
    memberId: 'm4',
    hours: 20,
  });
  const after = contributions(p).reduce((s, c) => s + c.score, 0);
  assert.ok(Math.abs(after - before) < 0.2);
  assert.ok(contributions(p).find((c) => c.member.id === 'm4').score > 0);
});
test('pending and rejected work does not earn points', () => {
  const p = seed();
  p.evidence.forEach((e) => (e.status = 'pending'));
  assert.ok(contributions(p).every((c) => c.score === 0 && c.share === 0));
});
