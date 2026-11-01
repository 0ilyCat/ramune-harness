import { describe, test, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../server/store';
import { Kernel } from '../server/kernel';
import { workflowSchema, validateGraph, runRequestSchema, type Workflow, type RunRecord } from '../shared/schema';

const dirs: string[] = [];
async function setup() { const dir = await mkdtemp(join(tmpdir(), 'ramune-test-')); dirs.push(dir); return { dir, store: new Store(join(dir, 'data')) }; }
afterEach(async () => { await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true }))); });
function graph(nodes: any[], edges: any[] = []): Workflow { return workflowSchema.parse({ version: 1, name: '自动验收', entry: nodes[0].id, nodes: nodes.map((n, i) => ({ id: n.id, position: { x: i * 200, y: 0 }, data: { instructions: '', ...n.data } })), edges }); }
function request(workflow: Workflow, workspace: string, extra = {}) { return runRequestSchema.parse({ workflow, workspace, prompt: '真实确定性测试', authorized: true, timeoutSeconds: 30, ...extra }); }
async function settled(kernel: Kernel, run: RunRecord) { const until = Date.now() + 15000; while (kernel.active.has(run.id) && Date.now() < until) await new Promise(r => setTimeout(r, 25)); expect(kernel.active.has(run.id)).toBe(false); return run; }
describe('顺序执行与持久化', () => {
  test('无需模型即可执行真实进程、保存结果并重新读取', async () => {
    const { dir, store } = await setup(), kernel = new Kernel(store);
    const workflow = graph([
      { id: 'input', data: { kind: 'value', label: '输入', instructions: '任务：{{prompt}}' } },
      { id: 'check', data: { kind: 'check', label: '检查', executable: process.execPath, args: ['-e', 'console.log("real-process-ok")'] } },
      { id: 'output', data: { kind: 'output', label: '结果' } },
    ], [{ id: '1', source: 'input', target: 'check' }, { id: '2', source: 'check', target: 'output' }]);
    const run = await settled(kernel, await kernel.start(request(workflow, dir)));
    expect(run.status).toBe('completed'); expect(run.context).toContain('real-process-ok'); expect(run.invocations).toHaveLength(3);
    expect(new Store(store.dir).get(run.id).revision).toBe(run.revision);
  });
  test('失败回路执行到通过，每轮具有独立调用身份', async () => {
    const { dir, store } = await setup(), kernel = new Kernel(store);
    const script = `const fs=require('fs');let n=0;try{n=+fs.readFileSync('counter')}catch{}fs.writeFileSync('counter',String(++n));console.log(n);process.exit(n<3?1:0)`;
    const workflow = graph([{ id: 'check', data: { kind: 'check', label: '计数检查', executable: process.execPath, args: ['-e', script] } }], [{ id: 'retry', source: 'check', target: 'check', sourceHandle: 'failure' }]);
    const run = await settled(kernel, await kernel.start(request(workflow, dir)));
    expect(run.status).toBe('completed'); expect(run.steps).toBe(3); expect(new Set(run.invocations.map(i => i.id)).size).toBe(3); expect(await readFile(join(dir, 'counter'), 'utf8')).toBe('3');
  });
  test('无限失败只能耗尽预算，不宣称成功', async () => {
    const { dir, store } = await setup(), kernel = new Kernel(store);
    const workflow = graph([{ id: 'check', data: { kind: 'check', label: '失败', executable: process.execPath, args: ['-e', 'process.exit(1)'] } }], [{ id: 'retry', source: 'check', target: 'check', sourceHandle: 'failure' }]);
    const run = await settled(kernel, await kernel.start(request(workflow, dir, { maxSteps: 2 })));
    expect(run.status).toBe('exhausted'); expect(run.steps).toBe(2); expect(run.events.some(e => e.type === 'run.completed')).toBe(false);
  });
  test('失败未配置路由时，重试仍执行失败节点，不能空恢复为成功', async () => {
    const { dir, store } = await setup(), kernel = new Kernel(store);
    const workflow = graph([{ id: 'check', data: { kind: 'check', label: '失败', executable: process.execPath, args: ['-e', 'process.exit(1)'] } }]);
    const run = await settled(kernel, await kernel.start(request(workflow, dir)));
    expect(run.status).toBe('failed'); await expect(kernel.resume(run.id, 'continue')).rejects.toThrow('必须明确选择');
    await settled(kernel, await kernel.resume(run.id, 'retry')); expect(run.status).toBe('failed'); expect(run.steps).toBe(2);
  });
  test('取消真实进程并保留未知副作用，不自动重放', async () => {
    const { dir, store } = await setup(), kernel = new Kernel(store);
    const workflow = graph([{ id: 'check', data: { kind: 'check', label: '长任务', executable: process.execPath, args: ['-e', 'console.log("ready");setTimeout(()=>{},60000)'] } }]);
    const run = await kernel.start(request(workflow, dir));
    while (!run.events.some(e => e.type === 'process.stdout')) await new Promise(r => setTimeout(r, 20));
    await expect(kernel.start(request(workflow, dir))).rejects.toThrow('已有运行');
    kernel.cancel(run.id); await settled(kernel, run);
    expect(run.status).toBe('cancelled'); expect(run.invocations[0].status).toBe('unknown');
    await expect(kernel.resume(run.id, 'continue')).rejects.toThrow('必须明确选择');
  });
  test('不同服务数据目录也不能同时运行同一真实工作目录', async () => {
    const { dir, store } = await setup();
    const first = new Kernel(store), second = new Kernel(new Store(join(dir, 'other-data')));
    const workflow = graph([{ id: 'check', data: { kind: 'check', label: '长任务', executable: process.execPath, args: ['-e', 'console.log("ready");setTimeout(()=>{},60000)'] } }]);
    const run = await first.start(request(workflow, dir));
    try { await expect(second.start(request(workflow, dir))).rejects.toThrow(); }
    finally { first.cancel(run.id); await settled(first, run); }
  });
  test('进程重启将 started 识别为 unknown，恢复必须人工明确决策', async () => {
    const { dir, store } = await setup();
    const workflow = graph([{ id: 'value', data: { kind: 'value', label: '输入', instructions: 'done' } }]);
    const req = request(workflow, dir), now = new Date().toISOString();
    store.save({ id: 'crash-test', status: 'running', createdAt: now, updatedAt: now, request: req, revision: 'fixture', nextNodeId: 'value', activeInvocationId: 'unknown-call', steps: 1, context: '', events: [], invocations: [{ id: 'unknown-call', nodeId: 'value', step: 1, status: 'started', startedAt: now }] });
    const restarted = new Store(store.dir), kernel = new Kernel(restarted), run = restarted.get('crash-test');
    expect(run.status).toBe('interrupted'); expect(run.invocations[0].status).toBe('unknown');
    await expect(kernel.resume(run.id, 'continue')).rejects.toThrow('必须明确选择');
    await settled(kernel, await kernel.resume(run.id, 'retry')); expect(run.status).toBe('completed'); expect(run.invocations).toHaveLength(2);
  });
  test('普通事件预算已经耗尽时，服务重启仍能保存中断与未知状态', async () => {
    const { dir, store } = await setup();
    const workflow = graph([{ id: 'value', data: { kind: 'value', label: '输入' } }]);
    const now = new Date().toISOString();
    store.save({ id: 'budget-crash', status: 'running', createdAt: now, updatedAt: now, request: request(workflow, dir), revision: 'fixture', nextNodeId: 'value', activeInvocationId: 'call', steps: 1, context: '', invocations: [{ id: 'call', nodeId: 'value', step: 1, status: 'started', startedAt: now }], events: Array.from({ length: 10000 }, (_, i) => ({ seq: i + 1, time: now, type: 'process.stdout', data: { text: '' } })) });
    const recovered = new Store(store.dir).get('budget-crash');
    expect(recovered.status).toBe('interrupted'); expect(recovered.invocations[0].status).toBe('unknown'); expect(recovered.events.at(-1)?.type).toBe('run.interrupted');
  });
  test('预算与工作目录输入校验', async () => {
    const { dir, store } = await setup(); const workflow = graph([{ id: 'v', data: { kind: 'value', label: '输入' } }]);
    expect(() => request(workflow, dir, { maxSteps: 0 })).toThrow();
    await expect(new Kernel(store).start(request(workflow, join(dir, 'missing')))).rejects.toThrow();
  });
  test('审查进程退出 0 也必须有明确 PASS；缺失结论不能验收', async () => {
    const { dir, store } = await setup();
    // 此处显式注入协议测试替身；真实 Agent 验收由 test:live 另行执行。
    const executor = async () => ({ output: '我没有提供结论标记', exitCode: 0, sessionId: 'protocol-test-double' });
    const kernel = new Kernel(store, executor);
    const workflow = graph([{ id: 'review', data: { kind: 'agent', agentId: 'codex', role: 'reviewer', label: '审查' } }]);
    const run = await settled(kernel, await kernel.start(request(workflow, dir)));
    expect(run.status).toBe('failed'); expect(run.events.some(e => e.type === 'review.verdict' && !(e.data as any).accepted)).toBe(true);
  });
});
test('连接必须引用实际节点且端口不能歧义', () => {
  const workflow = graph([{ id: 'a', data: { kind: 'value', label: '输入' } }], [{ id: '1', source: 'a', target: 'missing' }]);
  expect(() => validateGraph(workflow)).toThrow('不存在');
  workflow.edges = [{ id: '1', source: 'a', target: 'a', sourceHandle: 'success' }, { id: '2', source: 'a', target: 'a', sourceHandle: 'success' }]; expect(() => validateGraph(workflow)).toThrow('只能有一条');
});
