import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.RAMUNE_URL || 'http://127.0.0.1:4317';
const root = await fetch(base);
const cookie = root.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
async function api(path, body) {
  const response = await fetch(base + '/api' + path, { headers: { cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
  const json = await response.json(); assert.ok(response.ok, JSON.stringify(json)); return json;
}
const agents = await api('/agents');
console.log(JSON.stringify({ stage: 'discovery', agents }));
const agent = agents.find(a => a.installed && a.supported && a.auth === 'ready');
assert.ok(agent, '当前环境没有已认证可执行的 Harness');
const demo = await api('/workspaces/demo', {});
const workflow = await api('/workflow');
for (const node of workflow.nodes) if (node.data.kind === 'agent') node.data.agentId = agent.id;
const run = await api('/runs', { workflow, ...demo, maxSteps: 12, timeoutSeconds: 600, authorized: true });
console.log(JSON.stringify({ stage: 'started', id: run.id, workspace: demo.workspace }));
let last = 0;
for (;;) {
  const record = await api(`/runs/${run.id}`);
  for (const e of record.events.slice(last)) console.log(JSON.stringify({ seq: e.seq, type: e.type, node: e.nodeId, ...(e.type === 'agent.event' ? { providerType: e.data.type, itemType: e.data.item?.type } : e.type.includes('failed') ? { data: e.data } : {}) }));
  last = record.events.length;
  if (record.status !== 'running') {
    await mkdir('.ramune/evidence', { recursive: true });
    await writeFile(`.ramune/evidence/live-${new URL(base).port}.json`, JSON.stringify(record, null, 2));
    await writeFile(`.ramune/evidence/live-${new URL(base).port}-${record.id}.json`, JSON.stringify(record, null, 2));
    assert.equal(record.status, 'completed', record.error || JSON.stringify(record.events.slice(-5)));
    assert.ok(record.invocations.filter(i => i.sessionId).length >= 2, '必须有两个真实 Agent Session');
    assert.ok(record.events.some(e => e.type === 'check.result' && e.data.exitCode === 0), '独立验收必须通过');
    assert.ok(record.events.some(e => e.type === 'agent.event' && /command_execution|tool_use|tool_result/.test(JSON.stringify(e.data))), '必须记录原生工具事件');
    console.log(JSON.stringify({ stage: 'passed', id: record.id, sessions: record.invocations.filter(i => i.sessionId).map(i => i.sessionId), steps: record.steps }));
    break;
  }
  await new Promise(resolve => setTimeout(resolve, 2500));
}
