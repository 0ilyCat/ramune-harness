import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const base = process.env.RAMUNE_URL || 'http://127.0.0.1:4321';
const evidence = resolve(process.env.RAMUNE_EVIDENCE_DIR || '.ramune/openclaw-five-rounds'); await mkdir(evidence, { recursive: true });
const workspace = join(evidence, `workspace-${randomUUID()}`); await mkdir(workspace);
await writeFile(join(workspace, 'fixture.json'), JSON.stringify({ verification: 'RAMUNE_REAL_OPENCLAW_20261101', seed: 0 }));
await writeFile(join(workspace, 'round-state.json'), JSON.stringify({ round: 0, value: 0 }));
const checker = `import fs from 'node:fs';
const input=fs.readFileSync(0,'utf8');const matches=[...input.matchAll(/RAMUNE_VALUE=(\\d+)/g)];
const state=JSON.parse(fs.readFileSync('round-state.json','utf8'));const next=state.round+1;
if(!matches.length||Number(matches.at(-1)[1])!==next*2){console.error('ROUND_REJECTED',JSON.stringify({next,expected:next*2,input}));process.exit(2)}
fs.writeFileSync('round-state.json',JSON.stringify({round:next,value:next*2}));
console.log('ROUND_ACCEPTED '+JSON.stringify({round:next,value:next*2,roundsRequired:5}));
process.exit(next===5?0:1);
`;
await writeFile(join(workspace, 'verify-round.mjs'), checker);
const model = process.env.RAMUNE_OPENCLAW_TEST_MODEL || 'cliproxy/gemini-3.8-flash-high';
const instructions = '本次为隔离的算术交接验收。每次必须真实调用 read 工具读取 fixture.json 和 round-state.json，确认 verification 为 RAMUNE_REAL_OPENCLAW_20261101。只允许读文件；不要执行命令、修改文件、联网或发送任何消息。';
const workflow = { version: 1, name: 'OpenClaw 双卡片五轮真实验收', entry: 'left', nodes: [
  { id: 'left', type: 'card', position: { x: 0, y: 0 }, data: { kind: 'agent', agentId: 'openclaw', role: 'builder', label: 'OpenClaw 左卡', model, instructions: instructions + ' 左卡从 round-state.json 中的 value 加 1，最终回复只输出 RAMUNE_VALUE=结果。必须计算实际值，不能照抄占位符。' } },
  { id: 'right', type: 'card', position: { x: 330, y: 0 }, data: { kind: 'agent', agentId: 'openclaw', role: 'reviewer', label: 'OpenClaw 右卡', model, instructions: instructions + ' 右卡检查上一节点 RAMUNE_VALUE 是否为 round-state.json 的 value 加 1。正确则再加 1，输出 RAMUNE_VALUE=新结果，最后一行输出 RAMUNE_REVIEW: PASS；若不正确报告问题并 REVISE。' } },
  { id: 'round-check', type: 'card', position: { x: 330, y: 260 }, data: { kind: 'check', label: '是否完成五轮（failure 继续）', instructions: '', executable: process.execPath, args: ['verify-round.mjs'] } },
  { id: 'done', type: 'card', position: { x: 0, y: 260 }, data: { kind: 'output', label: '五轮验收终点', instructions: '' } },
], edges: [
  { id: 'a', source: 'left', target: 'right', sourceHandle: 'success' },
  { id: 'b', source: 'right', target: 'round-check', sourceHandle: 'success' },
  { id: 'c', source: 'round-check', target: 'left', sourceHandle: 'failure' },
  { id: 'd', source: 'round-check', target: 'done', sourceHandle: 'success' },
] };
const root = await fetch(base); const cookie = root.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
async function api(path, data) {
  const response = await fetch(base + '/api' + path, { headers: { cookie, ...(data ? { 'content-type': 'application/json' } : {}) }, ...(data ? { method: 'POST', body: JSON.stringify(data) } : {}) });
  const value = await response.json(); assert.ok(response.ok, JSON.stringify(value)); return value;
}
const run = await api('/runs', { workflow, workspace, prompt: '两张 OpenClaw 卡片按左、右顺序往返五轮，每轮将计数加二。第五轮必须到达正常输出终点；不得以耗尽预算、重复伪造响应或跳过工具读取冒充完成。', authorized: true, maxSteps: 20, timeoutSeconds: 1200 });
console.log('OPENCLAW_QA_STARTED ' + JSON.stringify({ runId: run.id, model, workspace }));
let after = 0, final;
for (;;) {
  const record = await api(`/runs/${run.id}`);
  for (const event of record.events.slice(after)) console.log('RAMUNE_QA_EVENT ' + JSON.stringify(event));
  after = record.events.length;
  if (record.status !== 'running') { final = record; break; }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
await writeFile(join(evidence, 'run-record.json'), JSON.stringify(final, null, 2));
await writeFile(join(evidence, `run-${final.id}.json`), JSON.stringify(final, null, 2));
await writeFile(join(evidence, 'run-events.jsonl'), final.events.map(event => JSON.stringify(event)).join('\n') + '\n');
const agents = final.invocations.filter(invocation => ['left', 'right'].includes(invocation.nodeId));
const native = final.events.filter(event => event.type === 'agent.event' && event.data.type === 'openclaw.result');
const state = JSON.parse(await readFile(join(workspace, 'round-state.json'), 'utf8'));
const summary = { runId: final.id, status: final.status, leftCalls: agents.filter(i => i.nodeId === 'left').length, rightCalls: agents.filter(i => i.nodeId === 'right').length, uniqueSessions: new Set(agents.map(i => i.sessionId)).size, nativeToolCalls: native.reduce((sum, event) => sum + (event.data.toolSummary?.calls || 0), 0), nativeTranscriptEvents: final.events.filter(event => event.type === 'agent.event' && event.data.type === 'openclaw.transcript').length, round: state.round, value: state.value, steps: final.steps, error: final.error };
console.log('OPENCLAW_QA_RESULT ' + JSON.stringify(summary));
await writeFile(join(evidence, 'summary.json'), JSON.stringify(summary, null, 2));
assert.equal(summary.status, 'completed'); assert.equal(summary.leftCalls, 5); assert.equal(summary.rightCalls, 5); assert.equal(summary.uniqueSessions, 10); assert.equal(summary.round, 5); assert.equal(summary.value, 10); assert.equal(summary.steps, 16); assert.ok(summary.nativeToolCalls >= 10); assert.ok(summary.nativeTranscriptEvents > 0);
assert.ok(native.every(event => event.data.ok && event.data.toolSummary.calls >= 1));
