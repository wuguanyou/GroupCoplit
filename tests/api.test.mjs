import test from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.GROUPPILOT_TEST_URL || 'http://localhost:3000';
test('project API loads persisted data and rejects invalid updates without changing revision', async () => {
  const r = await fetch(base + '/api/project');
  assert.equal(r.status, 200);
  const before = await r.json();
  assert.ok(before.project.tasks.length);
  assert.ok(before.project.members.length);
  for (const body of [
    {
      action: 'member',
      revision: before.revision,
      memberId: 'missing',
      dailyHours: 2,
    },
    {
      action: 'member',
      revision: before.revision,
      memberId: before.project.members[0].id,
      dailyHours: -1,
    },
    { action: 'reset', revision: before.revision, confirm: 'wrong' },
  ]) {
    const response = await fetch(base + '/api/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 400);
  }
  const stale = await fetch(base + '/api/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'replan', revision: -1 }),
  });
  assert.equal(stale.status, 409);
  const after = await (await fetch(base + '/api/project')).json();
  assert.equal(after.revision, before.revision);
  assert.deepEqual(after.project, before.project);
});
test('missing AI credentials are reported instead of a fabricated AI answer', async () => {
  const status = await (await fetch(base + '/api/project')).json();
  if (!status.aiConnected) {
    const r = await fetch(base + '/api/analysis', { method: 'POST' });
    assert.equal(r.status, 503);
    assert.match((await r.json()).error, /尚未設定/);
  }
});
