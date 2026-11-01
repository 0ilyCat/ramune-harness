import { test, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import { createServer } from 'node:http';
import { runRequestSchema } from '../shared/schema';
const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true }))); });
test('本地会话、Origin、Host、媒体类型与输入大小受到检查', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ramune-api-')); dirs.push(dir); await writeFile(join(dir, 'index.html'), '<html>真实本地服务</html>');
  const { app } = createApp({ dir: join(dir, 'data'), port: 4317, clientDir: dir });
  const call = (path: string, init?: RequestInit) => app.request(`http://127.0.0.1:4317${path}`, init);
  expect((await call('/api/runs')).status).toBe(401);
  expect((await call('/api/health', { headers: { host: 'evil.test' } })).status).toBe(403);
  const root = await call('/'); expect(root.status).toBe(200);
  const cookie = root.headers.get('set-cookie')!.split(';')[0];
  expect((await call('/api/runs', { headers: { cookie } })).status).toBe(200);
  expect((await call('/api/workspaces/demo', { method: 'POST', headers: { cookie, origin: 'https://evil.test', 'content-type': 'application/json' }, body: '{}' })).status).toBe(403);
  expect((await call('/api/workspaces/demo', { method: 'POST', headers: { cookie, 'content-type': 'text/plain' }, body: '{}' })).status).toBe(415);
  expect((await call('/api/runs', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' })).status).toBe(400);
  expect((await call('/api/runs', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ huge: 'x'.repeat(1024 * 1024) }) })).status).toBe(413);
  const result = await call('/api/workspaces/demo', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' });
  expect(result.status).toBe(200); const demo = await result.json(); expect(demo.workspace).toContain('acceptance-');
});
test('SSE 重连优先 Last-Event-ID，避免从最初的 query 游标重放', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ramune-sse-')); dirs.push(dir); await writeFile(join(dir, 'index.html'), '<html>fixture</html>');
  const { app, store } = createApp({ dir: join(dir, 'data'), port: 4317, clientDir: dir });
  const root = await app.request('http://127.0.0.1:4317/'), cookie = root.headers.get('set-cookie')!.split(';')[0];
  const now = new Date().toISOString();
  const request = runRequestSchema.parse({ prompt: 'SSE 协议夹具', workspace: dir, authorized: true, workflow: { version: 1, name: '游标夹具', entry: 'v', nodes: [{ id: 'v', position: { x: 0, y: 0 }, data: { kind: 'value', label: '纯数据' } }], edges: [] } });
  store.save({ id: 'cursor-fixture', status: 'completed', createdAt: now, updatedAt: now, request, revision: 'fixture', steps: 0, invocations: [], context: '', events: Array.from({ length: 4 }, (_, i) => ({ seq: i + 1, time: now, type: 'test.fixture', data: {} })) });
  const response = await app.request('http://127.0.0.1:4317/api/runs/cursor-fixture/events?after=0', { headers: { cookie, 'last-event-id': '2' } });
  const ids = [...(await response.text()).matchAll(/^id: (\d+)$/gm)].map(match => Number(match[1]));
  expect(ids).toEqual([3, 4]);
});
test('模型目录只返回模型标识，私有网关凭据不会出现在响应', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ramune-models-')); dirs.push(dir); await writeFile(join(dir, 'index.html'), '<html>fixture</html>');
  const server = createServer((request, response) => {
    if (request.headers.authorization !== 'Bearer integration-test-only') { response.writeHead(403).end(); return; }
    response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ data: ['gemini-4-argon-high', 'gemini-3.8-flash-high', 'claude-opus-5-5-high'].map(id => ({ id })) }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const dataDir = join(dir, 'data'); await mkdir(dataDir);
    await writeFile(join(dataDir, 'proxy-settings.json'), JSON.stringify({ baseUrl: `http://127.0.0.1:${(server.address() as any).port}/v1`, apiKey: 'integration-test-only' }));
    const { app } = createApp({ dir: dataDir, port: 4317, clientDir: dir });
    const root = await app.request('http://127.0.0.1:4317/'), cookie = root.headers.get('set-cookie')!.split(';')[0];
    const response = await app.request('http://127.0.0.1:4317/api/models', { headers: { cookie } });
    const result = await response.json(); expect(result.requested.every((item: any) => item.configured)).toBe(true); expect(JSON.stringify(result)).not.toContain('integration-test-only');
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
