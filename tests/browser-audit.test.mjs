import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHmac,randomUUID} from 'node:crypto';
const {Miniflare}=createRequire(realpathSync('node_modules/wrangler/wrangler-dist/cli.js'))('miniflare');

test('browser audit of all tabs, chat, export, project selection and mobile layout', async t=>{
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

  const created=await call('/api/workspace',{body:{action:'create',name:'UI 驗證專案',requirements:'合成測試資料',deadline:'2030-12-31',displayName:'Alice'}});
  projectId=created.r.headers.get('set-cookie').match(/gp_project=([^;]+)/)[1];
  await mutate({action:'task',title:'UI 驗證任務',skill:'planning',hours:4,difficulty:1,deps:[],criteria:'測試交付'});
  const {createServer}=await import('node:http');
  const server=createServer(async(req,res)=>{try{
    const path=new URL(req.url,'http://localhost:3000').pathname;
    if(path.startsWith('/_next/') || path==='/vinext-client-entry-manifest.json'){
      const file=resolve('dist/client','.'+path);if(!file.startsWith(resolve('dist/client')))throw Error('bad path');
      const bytes=readFileSync(file);res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'application/json');res.end(bytes);return;
    }
    const chunks=[];for await(const c of req)chunks.push(c);
    const response=await mf.dispatchFetch('http://localhost:3000'+req.url,{method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
    res.statusCode=response.status;for(const[k,v]of response.headers)res.setHeader(k,v);res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){res.statusCode=500;res.end(String(e));}});
  await new Promise(r=>server.listen(3014,'127.0.0.1',r));
  const {chromium}=createRequire(resolve('work/browser-audit.mjs'))('C:/Users/Owner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:850}});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    // Keep the local proxy URL consistent with trusted-origin validation.
    await page.route('**/api/**',async route=>{const request=route.request();const headers={...request.headers(),origin:'http://localhost:3000'};const response=await route.fetch({headers});await route.fulfill({response});});
    const cookie=cookies.alice.split('=');await context.addCookies([{name:cookie[0],value:cookie.slice(1).join('='),url:'http://127.0.0.1:3014',httpOnly:true}]);
    await page.goto('http://127.0.0.1:3014');await page.getByRole('heading',{name:'選擇要進入的專案'}).waitFor();
    await page.getByRole('button',{name:/UI 驗證專案/}).click();await page.getByRole('heading',{name:'讓團隊專注，把協調交給我。'}).waitFor();
    for(const name of ['專案總覽','AI 代理組長','任務與依賴','團隊與分工','團隊聊天室','貢獻分析','資料與交付','代理紀錄']){
      await page.locator('nav').getByRole('button',{name,exact:true}).click();await page.waitForTimeout(200);console.log('UI tab passed:',name);
    }
    await page.locator('nav').getByRole('button',{name:'團隊聊天室',exact:true}).click();await page.getByLabel('輸入訊息').fill('瀏覽器驗證訊息');await page.getByRole('button',{name:'傳送訊息',exact:true}).click();await page.locator('.chat-message').filter({hasText:'瀏覽器驗證訊息'}).waitFor();
    await page.screenshot({path:'work/audit-chat-desktop.png',fullPage:true});
    await page.locator('nav').getByRole('button',{name:'貢獻分析',exact:true}).click();const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'下載學習報告'}).click();assert.match((await downloaded).suggestedFilename(),/\.md$/);
    await page.setViewportSize({width:390,height:844});await page.locator('nav').getByRole('button',{name:'任務與依賴',exact:true}).click();await page.screenshot({path:'work/audit-tasks-mobile.png',fullPage:true});
    const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));console.log('mobile width:',width);assert.ok(width.scroll<=width.viewport+1,'mobile page overflows viewport');
    await page.getByRole('button',{name:'切換專案',exact:true}).click();await page.getByRole('heading',{name:'選擇要進入的專案'}).waitFor();await page.screenshot({path:'work/audit-chooser-mobile.png',fullPage:true});
    assert.deepEqual(errors,[]);console.log('Browser chat, export, project switching and responsive checks passed');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
 }finally{await mf.dispose();}
});
