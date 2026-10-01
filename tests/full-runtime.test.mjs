import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHmac,randomUUID} from 'node:crypto';
const {Miniflare}=createRequire(realpathSync('node_modules/wrangler/wrangler-dist/cli.js'))('miniflare');

test('full built Worker workflow with isolated D1, R2 and real signed sessions', async t=>{
 const secret=randomUUID()+randomUUID();
 const mf=new Miniflare({modules:['index.js',...readdirSync('dist/server',{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:'dist/server',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{AUTH_URL:'http://localhost:3000',AUTH_SECRET:secret,GOOGLE_CLIENT_ID:'synthetic-google',GOOGLE_CLIENT_SECRET:'synthetic-only',GITHUB_CLIENT_ID:'synthetic-github',GITHUB_CLIENT_SECRET:'synthetic-only'}});
 try {
  const db=await mf.getD1Database('DB');
  for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+f,'utf8').split(';').map(s=>s.replace(/--> statement-breakpoint/g,'').trim()).filter(Boolean))await db.prepare(sql).run();
  const cookies={};
  for(const user of ['alice','bob','outsider']){const now=Date.now(),token=randomUUID();await db.prepare('INSERT INTO auth_user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(user,user,user+'@example.test',1,now,now).run();await db.prepare('INSERT INTO auth_session (id,user_id,token,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(randomUUID(),user,token,now+3600000,now,now).run();cookies[user]='grouppilot.session_token='+encodeURIComponent(token+'.'+createHmac('sha256',secret).update(token).digest('base64'));}
  let projectId,taskId,secondTask,fileId,evidenceId;
  const call=async(path,{user='alice',body,form,project=projectId,origin='http://localhost:3000'}={})=>{
   const headers={Origin:origin,...(user?{Cookie:cookies[user]}:{}),...(project?{'x-project-id':project}:{}),...(body?{'Content-Type':'application/json'}:{})};
   let upload=form; if(form){const encoded=new Response(form);headers['Content-Type']=encoded.headers.get('Content-Type');upload=await encoded.arrayBuffer();}
   const r=await mf.dispatchFetch('http://localhost:3000'+path,{method:body||form?'POST':'GET',headers,...(body||form?{body:upload||JSON.stringify(body)}:{})});
   const raw=await r.text();let j;try{j=JSON.parse(raw);}catch{j=raw;}return {r,j};
  };
  const mutate=async(body,user='alice')=>{const {j}=await call('/api/project',{user});return call('/api/project',{user,body:{...body,revision:j.revision}});};
  await t.test('anonymous isolation and independent OAuth redirects',async()=>{
   assert.equal((await call('/api/workspace',{user:null})).j.user,null);
   for(const path of ['/api/project','/api/files','/api/chat','/api/agent'])assert.equal((await call(path,{user:null})).r.status,401);
   for(const provider of ['google','github']){const {r,j}=await call('/api/auth/sign-in/social',{body:{provider,callbackURL:'/'}});assert.equal(r.status,200,JSON.stringify(j));assert.match(j.url,provider==='google'?/^https:\/\/accounts.google.com/:/^https:\/\/github.com/);}
   assert.equal((await call('/api/auth/sign-in/social',{origin:'https://evil.example',body:{provider:'google',callbackURL:'/'}})).r.status,403);
  });
  await t.test('create, invitation, membership and empty forecast',async()=>{
   const {r,j}=await call('/api/workspace',{body:{action:'create',name:'Runtime audit',requirements:'Synthetic workflow only',deadline:'2030-12-31',displayName:'Alice'}});assert.equal(r.status,200,JSON.stringify(j));projectId=r.headers.get('set-cookie').match(/gp_project=([^;]+)/)[1];
   const snapshot=(await call('/api/project')).j;assert.equal(snapshot.project.tasks.length,0);assert.equal(snapshot.analysis.finishDate,null);
   const code=(await call('/api/workspace',{body:{action:'invite'}})).j.code;
   assert.equal((await call('/api/workspace',{user:'bob',body:{action:'join',code,displayName:'Bob'}})).r.status,200);
   assert.equal((await call('/api/project',{user:'outsider'})).r.status,403);
   assert.equal((await call('/api/workspace',{user:'outsider',body:{action:'select',projectId}})).r.status,403);
   assert.equal((await call('/api/workspace',{body:{action:'select',projectId}})).r.status,200);
   assert.equal((await call('/api/workspace')).j.projects.length,1);
  });
  await t.test('task creation, manual mode, forecast, permissions and stale writes',async()=>{
   await mutate({action:'auto',enabled:false});
   const task={action:'task',title:'First task',skill:'planning',hours:4,difficulty:1,deps:[],criteria:'Text artifact'};
   assert.equal((await mutate(task,'bob')).r.status,403);assert.equal((await mutate(task)).r.status,200);
   let s=(await call('/api/project')).j;taskId=s.project.tasks[0].id;assert.equal(s.analysis.finishDate,null);
   assert.equal((await mutate({action:'replan'})).r.status,200);s=(await call('/api/project')).j;assert.ok(s.analysis.finishDate);assert.equal(s.project.tasks[0].due,'2030-12-31');
   assert.equal((await call('/api/project',{body:{action:'project',revision:-1,name:'stale',requirements:'bad',deadline:'2030-01-01'}})).r.status,409);
   assert.equal((await mutate({...task,title:'Second task',deps:[taskId]})).r.status,200);await mutate({action:'replan'});s=(await call('/api/project')).j;secondTask=s.project.tasks[1].id;
   const slots=s.analysis.slots;assert.ok(slots.find(x=>x.taskId===secondTask).start>=slots.find(x=>x.taskId===taskId).end);
   const owner=s.project.tasks[0].owner;assert.equal((await mutate({action:'report',taskId,memberId:owner,remainingHours:3,unavailableUntil:'2026-10-02',note:'Synthetic progress'},owner)).r.status,200);
  });
  await t.test('file upload, exact download and invalid/cross-project protection',async()=>{
   const form=new FormData();form.set('file',new File(['synthetic content'],'測試.txt'));form.set('category','submission');form.set('taskId',taskId);
   const {r,j}=await call('/api/files',{form});assert.equal(r.status,200,JSON.stringify(j));fileId=j.file.id;
   assert.equal((await call('/api/files?id='+fileId,{user:'bob'})).j,'synthetic content');assert.equal((await call('/api/files?id='+fileId,{user:'outsider'})).r.status,403);
   const bad=new FormData();bad.set('file',new File(['x'],'bad.html'));assert.equal((await call('/api/files',{form:bad})).r.status,400);
  });
  await t.test('submit, reject, resubmit and second-person acceptance preserve contribution',async()=>{
   const delivery={action:'evidence',taskId,memberId:'alice',hours:2,note:'Synthetic delivery',kind:'delivery',url:'',fileIds:[fileId]};
   assert.equal((await mutate({...delivery,memberId:'alice'},'bob')).r.status,403);assert.equal((await mutate(delivery)).r.status,200);
   let s=(await call('/api/project')).j;evidenceId=s.project.evidence[0].id;
   assert.equal((await mutate({action:'review',memberId:'alice',evidenceId,accept:true})).r.status,400);
   assert.equal((await mutate({action:'review',memberId:'bob',evidenceId,accept:false},'bob')).r.status,200);
   assert.equal((await call('/api/project')).j.contributions.find(c=>c.member.id==='alice').score,0);
   await mutate(delivery);s=(await call('/api/project')).j;evidenceId=s.project.evidence.at(-1).id;
   const owner=s.project.tasks[0].owner;
   assert.equal((await mutate({action:'report',memberId:owner,taskId,note:'Invalid while review',remainingHours:1,unavailableUntil:'2026-10-02'},owner)).r.status,400);
   assert.equal((await mutate({action:'review',memberId:'bob',evidenceId,accept:true},'bob')).r.status,200);
   s=(await call('/api/project')).j;assert.equal(s.project.tasks[0].status,'done');assert.ok(s.contributions.find(c=>c.member.id==='alice').score>0);
  });
  await t.test('chat persistence, retries and member reads',async()=>{
   const body={body:'Synthetic team message',nonce:randomUUID()};assert.equal((await call('/api/chat',{body})).r.status,200);await call('/api/chat',{body});assert.equal((await call('/api/chat',{user:'bob'})).j.messages.length,1);
  });
  await t.test('background scheduled event persists once and preserves deadlines',async()=>{
   const before=(await call('/api/project')).j;
   const worker=await mf.getWorker();const event={scheduledTime:new Date('2026-10-02T00:00:00Z').getTime(),cron:'0 * * * *'};
   assert.equal((await worker.scheduled(event)).outcome,'ok');const after=(await call('/api/project')).j;
   assert.equal(after.project.backgroundCheckedAt,'2026-10-02T00:00:00.000Z');assert.deepEqual(after.project.tasks.map(t=>t.due),before.project.tasks.map(t=>t.due));
   await worker.scheduled(event);assert.equal((await call('/api/project')).j.revision,after.revision);
  });
  await t.test('project switching isolates messages and attachments',async()=>{
   const {r}=await call('/api/workspace',{body:{action:'create',name:'Other',requirements:'Other fixture',deadline:'2030-12-31',displayName:'Alice'}});const other=r.headers.get('set-cookie').match(/gp_project=([^;]+)/)[1];
   assert.deepEqual((await call('/api/chat',{project:other})).j.messages,[]);assert.equal((await call('/api/files?id='+fileId,{project:other})).r.status,404);assert.equal((await call('/api/project')).j.project.tasks.length,2);
  });
  await t.test('disabled AI rejects requests and logout invalidates the session',async()=>{
   assert.ok((await call('/api/agent',{body:{action:'run',kind:'analysis'}})).r.status>=400);
   assert.equal((await call('/api/auth/sign-out',{body:{}})).r.status,200);assert.equal((await call('/api/workspace')).j.user,null);
  });
 }finally{await mf.dispose();}
});

