import assert from 'node:assert/strict';
import { execa } from 'execa';
import { createServer } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
const dir = resolve('.ramune/restart-tests', randomUUID()); await mkdir(dir, { recursive: true });
const listener = createServer(); await new Promise(r => listener.listen(0, '127.0.0.1', r)); const port = listener.address().port; await new Promise(r => listener.close(r));
const base = `http://127.0.0.1:${port}`; let cookie = '', child;
async function api(path, data) { const r = await fetch(base + '/api' + path, { headers: { cookie, ...(data ? { 'content-type': 'application/json' } : {}) }, ...(data ? { method: 'POST', body: JSON.stringify(data) } : {}) }); return { status: r.status, data: await r.json() }; }
async function launch() {
  child = execa(process.execPath, ['dist/server/index.js'], { env: { PORT: String(port), RAMUNE_DATA_DIR: join(dir, 'data') }, reject: false, killDescendants: true }); void child.catch(() => {});
  for (let i = 0; i < 100; i++) { try { const r = await fetch(base); if (r.ok) { cookie = r.headers.getSetCookie().map(v => v.split(';')[0]).join('; '); return; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error('测试服务启动超时');
}
try {
  await launch();
  const workflow = { version: 1, name: '真实崩溃恢复验收', entry: 'check', nodes: [{ id: 'check', position: { x: 0, y: 0 }, data: { kind: 'check', label: '有副作用的真实进程', executable: process.execPath, args: ['-e', `const fs=require('fs');let n=0;try{n=+fs.readFileSync('counter')}catch{}fs.writeFileSync('counter',String(++n));console.log('READY');if(n===1)setTimeout(()=>{},30000)`] } }], edges: [] };
  const { data: run } = await api('/runs', { workflow, workspace: dir, prompt: '模拟服务被强制终止后的未知副作用', maxSteps: 5, timeoutSeconds: 60, authorized: true });
  for (let i = 0; i < 100; i++) { const { data: state } = await api(`/runs/${run.id}`); if (state.events.some(e => e.type === 'process.stdout')) break; await new Promise(r => setTimeout(r, 100)); }
  assert.equal(await readFile(join(dir, 'counter'), 'utf8'), '1');
  child.kill('SIGKILL'); await child; await launch();
  const { data: interrupted } = await api(`/runs/${run.id}`);
  assert.equal(interrupted.status, 'interrupted'); assert.equal(interrupted.invocations[0].status, 'unknown');
  await new Promise(r => setTimeout(r, 300)); assert.equal(await readFile(join(dir, 'counter'), 'utf8'), '1', '重启不得自动重放');
  assert.equal((await api(`/runs/${run.id}/resume`, { action: 'continue', confirmed: true })).status, 400);
  assert.equal((await api(`/runs/${run.id}/resume`, { action: 'retry', confirmed: true })).status, 200);
  let final;
  for (let i = 0; i < 100; i++) { final = (await api(`/runs/${run.id}`)).data; if (final.status !== 'running') break; await new Promise(r => setTimeout(r, 100)); }
  assert.equal(final.status, 'completed'); assert.equal(final.steps, 2); assert.equal(await readFile(join(dir, 'counter'), 'utf8'), '2');
  await mkdir('.ramune/evidence', { recursive: true }); await writeFile('.ramune/evidence/restart.json', JSON.stringify({ runId: run.id, interrupted: interrupted.status, pending: interrupted.invocations[0].status, autoReplay: false, finalStatus: final.status, count: 2 }, null, 2));
  console.log('真实服务强制终止、重启、拒绝自动重放、明确重试验收通过');
} finally { if (child) { child.kill('SIGKILL'); await child.catch(() => {}); } }
