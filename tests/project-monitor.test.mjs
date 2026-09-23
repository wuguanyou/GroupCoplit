import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../lib/project.ts';
import { inspectProject, runProjectMonitor } from '../lib/project-monitor.ts';
const at = '2026-09-22T10:00:00.000Z';
test('background checks deduplicate, preserve evidence and deadlines, and respect manual assignment', () => {
  const p = seed(); p.demo = false; p.auto = false;
  p.tasks.forEach(t => { t.due = '2026-09-01'; });
  const before = structuredClone(p);
  const next = inspectProject(p, at);
  assert.deepEqual(p, before);
  assert.deepEqual(next.tasks, p.tasks);
  assert.deepEqual(next.evidence, p.evidence);
  assert.equal(inspectProject(next, at), null);
  const again = inspectProject(next, '2026-09-22T11:00:00.000Z');
  assert.equal(again.events.length, next.events.length);
  assert.equal(inspectProject({...p, demo: true}, at), null);
});
test('automatic background handoff preserves submitted work and task due dates', () => {
  const p = seed(); p.demo = false; p.auto = true;
  p.members.forEach(m => m.unavailableUntil = '2026-09-01');
  p.members.find(m => m.id === 'm3').dailyHours = 0;
  const next = inspectProject(p, at);
  assert.notEqual(next.tasks.find(t => t.id === 't4').owner, 'm3');
  assert.deepEqual(next.tasks.map(t => t.due), p.tasks.map(t => t.due));
  assert.deepEqual(next.evidence, p.evidence);
});
test('a concurrent user update is never overwritten by a background check', async () => {
  const p = seed(); p.demo = false;
  let reads=0, updates=0;
  const db = {prepare(sql){return {bind(...values){return {
    async all(){ return {results: reads++ ? [] : [{id:'p1',data:JSON.stringify(p),revision:7}]}; },
    async run(){assert.ok(sql.includes('AND revision = ?'));assert.equal(values[2],7);updates++;return {meta:{changes:0}};}
  };}};}};
  await runProjectMonitor(db, at);
  assert.equal(updates,1);
});
