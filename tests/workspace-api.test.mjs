import test from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL ?? 'http://localhost:8787';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw Error('Synthetic identity tests are local-only');
const id = crypto.randomUUID();
const users = {
  a: 'synthetic-a-' + id,
  b: 'synthetic-b-' + id,
  c: 'synthetic-c-' + id,
};
let projectId, otherId, taskId, fileId, referenceId, invite, evidenceId;
async function call(
  path,
  { user = 'a', project = projectId, body, form, method } = {},
) {
  const headers = {};
  if (user) {
    headers['oai-authenticated-user-id'] = users[user];
    headers['oai-authenticated-user-email'] = user + '@example.test';
  }
  if (project) headers['x-project-id'] = project;
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(base + path, {
    method: method ?? (body || form ? 'POST' : 'GET'),
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const j = await r.json();
  return { r, j };
}
async function mutate(body, user = 'a') {
  const { j } = await call('/api/project', { user });
  return call('/api/project', {
    user,
    body: { ...body, revision: j.revision },
  });
}
test('anonymous visitors see login and cannot read project, files or AI history', async () => {
  assert.equal((await call('/api/workspace', { user: null })).j.user, null);
  for (const p of ['/api/project', '/api/files', '/api/agent'])
    assert.equal((await call(p, { user: null })).r.status, 401);
});
test('create starts empty, invitation joins real second identity, outsider denied', async () => {
  const { r } = await call('/api/workspace', {
    body: {
      action: 'create',
      name: 'Synthetic file integration',
      requirements: 'Fictional requirements only',
      deadline: '2027-12-31',
      displayName: 'Test A',
    },
  });
  assert.equal(r.status, 200);
  projectId = r.headers.get('set-cookie').match(/gp_project=([^;]+)/)[1];
  const { j } = await call('/api/project');
  assert.equal(j.project.tasks.length, 0);
  assert.equal(j.project.evidence.length, 0);
  assert.equal(j.project.demo, false);
  assert.equal(j.currentUserId, users.a);
  invite = (await call('/api/workspace', { body: { action: 'invite' } })).j
    .code;
  assert.ok(invite);
  assert.equal(
    (
      await call('/api/workspace', {
        user: 'b',
        body: { action: 'join', code: invite, displayName: 'Test B' },
      })
    ).r.status,
    200,
  );
  assert.equal(
    (await call('/api/project', { user: 'b' })).j.project.members.length,
    2,
  );
  assert.equal((await call('/api/project', { user: 'c' })).r.status, 403);
  assert.equal((await call('/api/files', { user: 'c' })).r.status, 403);
});
test('only owner creates tasks; member cannot impersonate another contributor', async () => {
  const task = {
    action: 'task',
    title: 'Synthetic task',
    skill: 'planning',
    hours: 2,
    difficulty: 1,
    deps: [],
    criteria: 'Submit test text',
  };
  assert.equal((await mutate(task, 'b')).r.status, 403);
  assert.equal((await mutate(task)).r.status, 200);
  taskId = (await call('/api/project')).j.project.tasks[0].id;
  assert.equal(
    (
      await mutate(
        {
          action: 'evidence',
          taskId,
          memberId: users.a,
          hours: 1,
          note: 'fake attribution',
          kind: 'delivery',
        },
        'b',
      )
    ).r.status,
    403,
  );
});
test('R2 upload and download preserve bytes, reject invalid files and cross-project access', async () => {
  for (const category of ['reference', 'submission']) {
    const form = new FormData();
    form.set(
      'file',
      new File(['synthetic test bytes'], '測試.txt', { type: 'text/plain' }),
    );
    form.set('category', category);
    form.set('taskId', taskId);
    const { r, j } = await call('/api/files', { form });
    assert.equal(r.status, 200, JSON.stringify(j));
    if (category === 'submission') fileId = j.file.id;
    else referenceId = j.file.id;
  }
  const headers = {
    'oai-authenticated-user-id': users.b,
    'oai-authenticated-user-email': 'b@example.test',
    'x-project-id': projectId,
  };
  const downloaded = await fetch(base + '/api/files?id=' + fileId, { headers });
  assert.equal(downloaded.status, 200);
  assert.equal(await downloaded.text(), 'synthetic test bytes');
  assert.match(downloaded.headers.get('content-disposition'), /^attachment/);
  assert.equal(
    (await call('/api/files?id=' + fileId, { user: 'c' })).r.status,
    403,
  );
  const form = new FormData();
  form.set('file', new File(['bad'], 'test.html'));
  assert.equal((await call('/api/files', { form })).r.status, 400);
});
test('attachment ownership checked; submission awaits second-person acceptance', async () => {
  const body = {
    action: 'evidence',
    taskId,
    memberId: users.a,
    hours: 1,
    note: 'Synthetic file delivery',
    kind: 'delivery',
    url: '',
    fileIds: [fileId],
  };
  assert.equal(
    (await mutate({ ...body, memberId: users.b }, 'b')).r.status,
    400,
  );
  assert.equal(
    (await mutate({ ...body, fileIds: [referenceId] })).r.status,
    400,
  );
  assert.equal((await mutate(body)).r.status, 200);
  let snapshot = (await call('/api/project')).j;
  evidenceId = snapshot.project.evidence[0].id;
  assert.deepEqual(snapshot.project.evidence[0].fileIds, [fileId]);
  assert.equal(snapshot.project.tasks[0].status, 'review');
  assert.equal(
    (
      await mutate({
        action: 'review',
        memberId: users.a,
        evidenceId,
        accept: true,
      })
    ).r.status,
    400,
  );
  assert.equal(
    (
      await mutate(
        { action: 'review', memberId: users.b, evidenceId, accept: true },
        'b',
      )
    ).r.status,
    200,
  );
  snapshot = (await call('/api/project')).j;
  assert.equal(snapshot.project.tasks[0].status, 'done');
  assert.ok(
    snapshot.contributions.find((c) => c.member.id === users.a).score > 0,
  );
});
test('project request header preserves scope across workspace switches', async () => {
  const { r } = await call('/api/workspace', {
    body: {
      action: 'create',
      name: 'Separate synthetic project',
      requirements: 'Other test data',
      deadline: '2027-12-31',
      displayName: 'Test A',
    },
  });
  otherId = r.headers.get('set-cookie').match(/gp_project=([^;]+)/)[1];
  assert.equal(
    (await call('/api/files', { project: otherId })).j.files.length,
    0,
  );
  assert.equal(
    (await call('/api/files?id=' + fileId, { project: otherId })).r.status,
    404,
  );
  assert.equal(
    (await call('/api/project', { project: projectId })).j.project.tasks.length,
    1,
  );
  assert.equal(
    (await call('/api/project', { project: otherId })).j.project.tasks.length,
    0,
  );
});
