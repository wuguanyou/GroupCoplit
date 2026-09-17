import test from 'node:test';
import assert from 'node:assert/strict';
const base=process.env.GROUPPILOT_TEST_URL || 'http://localhost:3000';
test('anonymous session exposes no project records',async()=>{const r=await fetch(base+'/api/workspace');assert.equal(r.status,200);const j=await r.json();assert.equal(j.user,null);assert.deepEqual(j.projects,[]);});
test('protected API rejects anonymous reads and writes',async()=>{for(const path of ['/api/project','/api/files','/api/agent']){assert.equal((await fetch(base+path)).status,401);}for(const path of ['/api/project','/api/files','/api/agent','/api/analysis']){assert.equal((await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);}});
