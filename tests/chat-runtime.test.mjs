// Run after `node scripts/build.mjs`; uses an isolated in-memory local database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createHmac, randomUUID } from 'node:crypto';
const require=createRequire(realpathSync('node_modules/wrangler/wrangler-dist/cli.js'));
const {Miniflare}=require('miniflare');
test('built Worker enforces real session and project membership for chat', async () => {
  const secret=randomUUID()+randomUUID();
  const mf=new Miniflare({
    modules:['index.js',...readdirSync('dist/server',{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),
    modulesRoot:'dist/server',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{AUTH_URL:'http://localhost:3000',AUTH_SECRET:secret}
  });
  try {
    const db=await mf.getD1Database('DB');
    for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()) {
      for(const stmt of readFileSync('drizzle/'+file,'utf8').split(';').map(s=>s.replace(/--> statement-breakpoint/g,'').trim()).filter(Boolean)) await db.prepare(stmt).run();
    }
    const cookies={};
    for(const name of ['alice','bob','outsider']) {
      const now=Date.now(), token=randomUUID();
      await db.prepare('INSERT INTO auth_user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(name,name,name+'@example.test',1,now,now).run();
      await db.prepare('INSERT INTO auth_session (id,user_id,token,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(randomUUID(),name,token,now+3600000,now,now).run();
      cookies[name]='grouppilot.session_token='+encodeURIComponent(token+'.'+createHmac('sha256',secret).update(token).digest('base64'));
    }
    for(const name of ['alice','bob']) await db.prepare('INSERT INTO project_members VALUES (?,?,?,?)').bind(randomUUID(),'team',name,'member').run();
    const call=(user,body,project='team')=>mf.dispatchFetch('http://localhost:3000/api/chat',{method:body?'POST':'GET',headers:{...(user?{Cookie:cookies[user]}:{}),'x-project-id':project,Origin:'http://localhost:3000','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    assert.equal((await call(null)).status,401);
    assert.equal((await call('outsider')).status,403);
    const payload={body:'Team integration test',nonce:randomUUID()};
    assert.equal((await call('alice',payload)).status,200);
    assert.equal((await call('alice',payload)).status,200);
    let response=await call('bob');assert.equal(response.status,200);
    const history=await response.json();assert.equal(history.messages.length,1);assert.equal(history.messages[0].userId,'alice');
    assert.equal((await call('bob',undefined,'other-team')).status,403);
    assert.equal((await call('outsider',payload)).status,403);
  } finally {await mf.dispose();}
});
