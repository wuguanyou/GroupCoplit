import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentService } from '../lib/agent-runner.ts';
import { getAIConfig, AgentError } from '../lib/ai-provider.ts';
import { seed, day, addDays } from '../lib/project.ts';
function fixture() {
  let project = seed(),
    revision = 0,
    calls = 0;
  project.deadline = addDays(day(), 60);
  const runs = new Map();
  const config = getAIConfig({
    AI_ENABLED: 'true',
    AI_BASE_URL: 'https://model.example/v1',
    AI_MODEL: 'fixture',
    AI_API_KEY: 'fixture',
    AI_OPERATOR_TOKEN: 'fixture-operator-1234567890',
  });
  let output = {
    summary: '新增',
    questions: [],
    tasks: [
      {
        key: 'new',
        title: '提醒介面',
        skill: 'design',
        hours: 1,
        difficulty: 1,
        deps: ['t2'],
        criteria: '提交設計',
      },
    ],
  };
  let delay = async () => {};
  const deps = {
    readProject: async () => ({ project: structuredClone(project), revision }),
    saveProject: async (p, rev) => {
      if (rev !== revision) throw new AgentError('stale', 409);
      project = structuredClone(p);
      revision++;
    },
    getRun: async (id) => runs.get(id) ?? null,
    listRuns: async () => [...runs.values()],
    reserveRun: async (r, limit) => {
      if (
        runs.size >= limit ||
        [...runs.values()].some((r) => r.status === 'running')
      )
        throw new AgentError('quota', 429);
      runs.set(r.id, structuredClone(r));
    },
    finishRun: async (id, status, result, message = '') => {
      const r = { ...runs.get(id), status, result, message };
      runs.set(id, r);
      return r;
    },
    aiConfig: () => config,
    generateJSON: async () => {
      calls++;
      await delay();
      return output;
    },
  };
  const service = createAgentService(deps);
  const send = (body, token = config.operatorToken) =>
    service.handleAgent(
      new Request('https://site.example/api/agent', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );
  return {
    send,
    service,
    get state() {
      return { project, revision, calls };
    },
    setOutput: (v) => (output = v),
    setDelay: (v) => (delay = v),
    bump: () => revision++,
    config,
  };
}
test('validated proposal persists only on apply, replay is idempotent', async () => {
  const f = fixture();
  const body = {
    action: 'run',
    kind: 'plan',
    requestId: 'fixture-request-0001',
    revision: 0,
    note: '通知',
    autoApply: false,
  };
  const r = await f.send(body);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).run.status, 'proposed');
  const original = f.state.project.tasks.length;
  assert.equal(f.state.revision, 0);
  await f.send(body);
  assert.equal(f.state.calls, 1);
  const applied = await f.send({ action: 'apply', runId: body.requestId });
  assert.equal(applied.status, 200);
  assert.equal(f.state.project.tasks.length, original + 1);
  await f.send({ action: 'apply', runId: body.requestId });
  assert.equal(f.state.project.tasks.length, original + 1);
  assert.equal(f.state.revision, 1);
});
test('revision changes reject stale proposals and preserve user data', async () => {
  const f = fixture();
  await f.send({
    action: 'run',
    kind: 'plan',
    requestId: 'fixture-request-0002',
    revision: 0,
    note: '通知',
    autoApply: false,
  });
  f.bump();
  const before = JSON.stringify(f.state.project);
  const r = await f.send({ action: 'apply', runId: 'fixture-request-0002' });
  assert.equal(r.status, 409);
  assert.equal(JSON.stringify(f.state.project), before);
});
test('automatic report executes tools; missing operator authentication never invokes model', async () => {
  const f = fixture();
  f.setOutput({
    summary: '考試',
    questions: [],
    remainingHours: 3,
    availableDate: addDays(day(), 7),
  });
  const body = {
    action: 'run',
    kind: 'report',
    requestId: 'fixture-request-0003',
    revision: 0,
    note: '還需3小時，七天後開始',
    taskId: 't4',
    autoApply: true,
  };
  assert.equal((await f.send(body, 'wrong')).status, 401);
  assert.equal(f.state.calls, 0);
  const r = await f.send(body);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).run.status, 'applied');
  assert.equal(f.state.revision, 1);
});
test('simultaneous model calls and failed output cannot modify project', async () => {
  const f = fixture();
  let release;
  f.setDelay(() => new Promise((r) => (release = r)));
  f.setOutput({ summary: 'incomplete' });
  const before = JSON.stringify(f.state.project);
  const body = {
    action: 'run',
    kind: 'plan',
    requestId: 'fixture-request-0004',
    revision: 0,
    note: 'x',
    autoApply: false,
  };
  const first = f.send(body);
  while (!release) await new Promise((r) => setTimeout(r, 1));
  assert.equal(
    (await f.send({ ...body, requestId: 'fixture-request-0005' })).status,
    429,
  );
  release();
  assert.equal((await first).status, 400);
  assert.equal(JSON.stringify(f.state.project), before);
});
