import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAIConfig,
  configStatus,
  generateJSON,
  authorizeAI,
} from '../lib/ai-provider.ts';
import { prepareAction } from '../lib/agent-tools.ts';
import { seed, day, addDays } from '../lib/project.ts';
const config = getAIConfig({
  AI_ENABLED: 'true',
  AI_BASE_URL: 'https://model.example/v1',
  AI_MODEL: 'test-model',
  AI_API_KEY: 'fixture-not-a-real-key',
  AI_OPERATOR_TOKEN: 'fixture-operator-passphrase-1234',
});
const raw = {
  summary: '補充通知',
  questions: [],
  tasks: [
    {
      key: 'new-1',
      title: '通知設計',
      skill: 'design',
      hours: 1,
      difficulty: 1,
      deps: ['t2'],
      criteria: '提交通知流程圖',
    },
  ],
};
test('plan creates only validated tasks and never mutates input', () => {
  const p = seed();
  p.deadline = addDays(day(), 60);
  const before = JSON.stringify(p);
  const r = prepareAction(p, 'plan', raw, { note: '' }, 'run-a');
  assert.equal(r.project.tasks.length, p.tasks.length + 1);
  assert.equal(JSON.stringify(p), before);
  assert.deepEqual(r.project.evidence, p.evidence);
  assert.ok(r.project.tasks.at(-1).owner);
});
test('cycles, unknown skills and injected fields reject the whole plan', () => {
  for (const patch of [
    { deps: ['new-1'] },
    { skill: 'invented' },
    { owner: 'm1' },
  ]) {
    const p = seed();
    const before = JSON.stringify(p);
    assert.throws(() =>
      prepareAction(
        p,
        'plan',
        { ...raw, tasks: [{ ...raw.tasks[0], ...patch }] },
        { note: '' },
        'bad',
      ),
    );
    assert.equal(JSON.stringify(p), before);
  }
});
test('missing report facts ask for clarification without changing work', () => {
  const p = seed();
  const r = prepareAction(
    p,
    'report',
    {
      summary: '沒空',
      questions: ['還需要幾小時？'],
      remainingHours: null,
      availableDate: null,
    },
    { note: '沒空', taskId: 't4' },
    'report',
  );
  assert.equal(r.needsClarification, true);
  assert.deepEqual(r.project, p);
});
test('parsed report updates availability and executes rules, preserving accepted contribution', () => {
  const p = seed();
  const r = prepareAction(
    p,
    'report',
    {
      summary: '考試',
      questions: [],
      remainingHours: 3,
      availableDate: addDays(day(), 7),
    },
    { note: '還需3小時，七天後才能做', taskId: 't4' },
    'report',
  );
  assert.equal(r.project.members[2].unavailableUntil, addDays(day(), 7));
  assert.equal(r.project.tasks.find((t) => t.id === 't4').hours, 3);
  assert.deepEqual(r.project.evidence, p.evidence);
  assert.notEqual(r.project.tasks.find((t) => t.id === 't4').owner, 'm3');
});
test('rebalance cannot assign to unskilled members or change completed work', () => {
  const p = seed();
  for (const a of [
    { taskId: 't4', memberId: 'm1', reason: 'x' },
    { taskId: 't1', memberId: 'm2', reason: 'x' },
  ])
    assert.throws(() =>
      prepareAction(
        p,
        'rebalance',
        { summary: 'x', questions: [], assignments: [a] },
        { note: '' },
        'r',
      ),
    );
});
test('chat and responses adapters use configured endpoint and parse complete JSON', async () => {
  for (const protocol of ['chat', 'responses']) {
    let request;
    const out = await generateJSON(
      { ...config, protocol },
      'instruction',
      { data: 'not a command' },
      { type: 'object' },
      async (url, init) => {
        request = { url, body: JSON.parse(init.body), headers: init.headers };
        return Response.json(
          protocol === 'chat'
            ? {
                choices: [
                  {
                    finish_reason: 'stop',
                    message: { content: '{"ok":true}' },
                  },
                ],
              }
            : {
                status: 'completed',
                output: [
                  { content: [{ type: 'output_text', text: '{"ok":true}' }] },
                ],
              },
        );
      },
    );
    assert.deepEqual(out, { ok: true });
    assert.match(
      request.url,
      protocol === 'chat' ? /chat\/completions$/ : /responses$/,
    );
    assert.equal(request.body.model, 'test-model');
    assert.ok(!JSON.stringify(request.body).includes(config.operatorToken));
  }
});
test('provider refusal, truncation, invalid JSON, quota and timeout never become fake results', async () => {
  for (const response of [
    () =>
      Response.json({
        choices: [{ finish_reason: 'length', message: { content: '{}' } }],
      }),
    () =>
      Response.json({
        choices: [{ finish_reason: 'stop', message: { content: 'not json' } }],
      }),
    () => new Response('limited', { status: 429 }),
    () => {
      throw Error('timeout');
    },
  ])
    await assert.rejects(() =>
      generateJSON(config, '', {}, {}, async () => response()),
    );
});
test('AI is disabled until explicit enable, config and separate operator token', async () => {
  assert.equal(configStatus(getAIConfig({})).configured, false);
  await assert.rejects(
    () => authorizeAI(new Request('https://site.example'), config),
    /通行碼/,
  );
  await authorizeAI(
    new Request('https://site.example', {
      headers: { Authorization: 'Bearer ' + config.operatorToken },
    }),
    config,
  );
  assert.throws(
    () => getAIConfig({ AI_BASE_URL: 'http://insecure.example' }),
    /HTTPS/,
  );
});
