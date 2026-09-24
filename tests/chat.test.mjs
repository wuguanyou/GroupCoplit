import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { parseMessage, chatCursor } from '../lib/chat.ts';

test('chat rejects empty, oversized and malformed messages and cursors', () => {
  for (const body of ['', '  ', 'x'.repeat(2001), null]) assert.throws(() => parseMessage({body, nonce:crypto.randomUUID()}));
  assert.throws(() => parseMessage({body:'hello',nonce:'bad'}));
  assert.throws(() => chatCursor('1 OR 1=1'));
  assert.equal(chatCursor(null),null);
  assert.equal(parseMessage({body:' hello ',nonce:crypto.randomUUID()}).body,'hello');
});

test('chat API stores history, isolates teams, checks identity and deduplicates retries', async () => {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0004_flaky_silver_surfer.sql',import.meta.url),'utf8'));
  const DB={prepare(sql){return {bind(...args){const q=sqlite.prepare(sql);return {async run(){return q.run(...args);},async first(){return q.get(...args);},async all(){return {results:q.all(...args)};}};}};}};
  let team='a', actor='alice';
  class AccessError extends Error {constructor(message,status=403){super(message);this.status=status;}}
  const fixture={env:{DB},AccessError,async access(){if(!actor)throw new AccessError('請先登入',401);if(team==='forbidden')throw new AccessError('你不是這個專案的成員');return {projectId:team,user:{userId:actor,displayName:actor}};},apiError(e){return Response.json({error:e.message},{status:e.status||503});},sameOrigin(r){if(r.headers.get('origin')&&r.headers.get('origin')!=='https://test.local')throw new AccessError('來源不符');},parseMessage,chatCursor};
  globalThis.__chatTest=fixture;
  let src=readFileSync(new URL('../app/api/chat/route.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  src='const {env,access,apiError,sameOrigin,AccessError,parseMessage,chatCursor}=globalThis.__chatTest;\n'+src;
  const route=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(src)).toString('base64'));
  const post=(body,nonce=crypto.randomUUID(),origin='https://test.local')=>route.POST(new Request('https://test.local/api/chat',{method:'POST',headers:{origin},body:JSON.stringify({body,nonce,userId:'spoofed',projectId:'forbidden'})}));
  const get=async(query='')=>{const r=await route.GET(new Request('https://test.local/api/chat'+query));return {status:r.status,...await r.json()};};
  try {
    const nonce=crypto.randomUUID();
    assert.equal((await post('<script>alert(1)</script>',nonce)).status,200);
    await post('<script>alert(1)</script>',nonce);
    let history=await get();assert.equal(history.messages.length,1);assert.equal(history.messages[0].userId,'alice');
    assert.equal(history.messages[0].body,'<script>alert(1)</script>');
    actor='bob'; assert.equal((await get()).messages.length,1);
    team='b';assert.equal((await get()).messages.length,0);await post('other team');
    team='a';for(let i=0;i<60;i++)await post('message '+i);
    history=await get();assert.equal(history.messages.length,50);assert.equal(history.hasMore,true);
    const older=await get('?before='+history.messages[0].id);assert.equal(older.messages.length,11);assert.equal(older.hasMore,false);
    const newer=await get('?after='+older.messages.at(-1).id);assert.equal(newer.messages.length,50);
    assert.ok(history.messages.every(m=>m.body!=='other team'));
    assert.equal((await post('x',crypto.randomUUID(),'https://evil.local')).status,403);
    assert.equal((await post('')).status,400);
    team='forbidden';assert.equal((await get()).status,403);assert.equal((await post('no')).status,403);
    actor='';assert.equal((await get()).status,401);
  } finally {sqlite.close();delete globalThis.__chatTest;}
});
