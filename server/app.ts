import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { streamSSE } from 'hono/streaming';
import { serveStatic } from '@hono/node-server/serve-static';
import { bodyLimit } from 'hono/body-limit';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { platform, release } from 'node:os';
import { z, ZodError } from 'zod';
import { runRequestSchema, workflowSchema, template, validateGraph } from '../shared/schema.js';
import { Store } from './store.js';
import { Kernel } from './kernel.js';
import { discoverAgents } from './agents.js';
import type { AgentInfo } from '../shared/schema.js';
import { modelCatalog } from './models.js';

export function createApp(options: { dir: string; port: number; clientDir?: string; kernel?: Kernel }) {
  const store = options.kernel?.store || new Store(options.dir);
  const kernel = options.kernel || new Kernel(store);
  const app = new Hono();
  const token = randomBytes(32).toString('hex'), cookie = `ramune_${options.port}`;
  let discovery: Promise<AgentInfo[]> | undefined, checkedAt = 0;
  const agents = async (refresh = false) => {
    if (!discovery || refresh || Date.now() - checkedAt > 30000) { checkedAt = Date.now(); discovery = discoverAgents(); }
    const infos = await discovery;
    return infos.map(info => {
      let configuredAt = 0;
      if (info.id === 'claude' && process.env.RAMUNE_CLAUDE_SETTINGS_FILE) { try { configuredAt = statSync(process.env.RAMUNE_CLAUDE_SETTINGS_FILE).mtimeMs; } catch { /* 使用真实调用诊断 */ } }
      const latest = [...store.runs.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).flatMap(run => run.events.filter(e => e.type === 'agent.result' && run.request.workflow.nodes.find(n => n.id === e.nodeId)?.data.agentId === info.id).slice(-1)).at(0);
      if (latest && Date.parse(latest.time) >= configuredAt && /authentication_failed|invalid api key|unauthorized|(?:http|error)\s*:?\s*401/i.test(JSON.stringify(latest.data))) return { ...info, auth: 'required' as const, detail: '最近一次真实调用认证失败（401）；请检查 CLI Proxy 地址与 Key，或原生登录凭据' };
      return info;
    });
  };
  const allowedHosts = new Set([`127.0.0.1:${options.port}`, `localhost:${options.port}`]);
  const allowedOrigins = new Set([...allowedHosts].map(host => `http://${host}`));
  if (process.env.NODE_ENV === 'development') { allowedOrigins.add('http://127.0.0.1:5173'); allowedOrigins.add('http://localhost:5173'); }
  app.use('*', async (c, next) => {
    if (!allowedHosts.has(c.req.header('host') || new URL(c.req.url).host)) return c.json({ error: 'Host 不受信任' }, 403);
    c.header('X-Content-Type-Options', 'nosniff'); c.header('Referrer-Policy', 'no-referrer');
    c.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
    const origin = c.req.header('origin');
    if (origin && !allowedOrigins.has(origin)) return c.json({ error: 'Origin 不受信任' }, 403);
    if (c.req.header('sec-fetch-site') === 'cross-site') return c.json({ error: '禁止跨站请求' }, 403);
    if (c.req.path.startsWith('/api/') && !['/api/health', '/api/session'].includes(c.req.path)) {
      if (getCookie(c, cookie) !== token) return c.json({ error: '请先打开本地页面建立会话' }, 401);
      if (!['GET', 'HEAD'].includes(c.req.method) && c.req.header('content-type')?.split(';')[0] !== 'application/json') return c.json({ error: '必须使用 application/json' }, 415);
      c.header('Cache-Control', 'no-store');
    }
    await next();
  });
  app.use('/api/*', bodyLimit({ maxSize: 1024 * 1024, onError: c => c.json({ error: '请求超过 1 MB' }, 413) }));
  app.onError((error, c) => c.json({ error: error instanceof ZodError ? error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : error.message }, 400));
  app.get('/api/health', c => c.json({ name: 'Ramune Harness', version: '0.1.0', status: 'ok' }));
  app.get('/api/session', c => { setCookie(c, cookie, token, { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 86400 }); c.header('Cache-Control', 'no-store'); return c.json({ ok: true }); });
  app.get('/api/environment', c => c.json({ platform: platform(), release: release(), node: process.version, cwd: process.cwd(), dataDir: resolve(options.dir), defaultWorkspace: resolve(options.dir, 'workspaces'), port: options.port }));
  app.get('/api/models', async c => c.json(await modelCatalog(options.dir)));
  app.get('/api/agents', async c => c.json(await agents(c.req.query('refresh') === '1')));
  app.get('/api/workflow', async c => { const saved = store.loadWorkflow(); if (saved) return c.json(workflowSchema.parse(saved)); const infos = await agents(); const available = infos.find(a => a.installed && a.supported && a.auth === 'ready') || infos.find(a => a.installed && a.supported); return c.json(template(available?.id === 'openclaw' ? 'openclaw' : available?.id === 'claude' ? 'claude' : 'codex')); });
  app.put('/api/workflow', async c => { const workflow = workflowSchema.parse(await c.req.json()); validateGraph(workflow); store.saveWorkflow(workflow); return c.json(workflow); });
  app.post('/api/workspaces/demo', async c => {
    const path = resolve(options.dir, 'workspaces', `acceptance-${randomUUID().slice(0, 8)}`);
    await mkdir(join(path, 'src'), { recursive: true });
    await writeFile(join(path, 'package.json'), JSON.stringify({ name: 'ramune-acceptance', private: true, type: 'module', scripts: { test: 'node --test' } }, null, 2));
    await writeFile(join(path, 'slugify.test.js'), `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { slugify } from './src/slugify.js';\nconst cases = [['Hello World','hello-world'],['  Hello__World!!  ','hello-world'],['Crème Brûlée','creme-brulee'],['A---B','a-b'],['',''],['中文 任务','中文-任务']];\nfor (const [input, expected] of cases) test(JSON.stringify(input), () => assert.equal(slugify(input), expected));\ntest('reject non-string', () => assert.throws(() => slugify(null), TypeError));\n`);
    return c.json({ workspace: path, prompt: '实现 src/slugify.js，导出 slugify(input)。字符串转小写，去除拉丁字母重音，空白、下划线和标点合并为单个连字符，去除首尾连字符，保留中文等 Unicode 字母及数字，空字符串返回空字符串，非字符串抛出 TypeError。真实运行 node --test 并修复直到全部通过。' });
  });
  app.get('/api/runs', c => c.json(store.list()));
  app.post('/api/runs', async c => { if (kernel.active.size >= 4) return c.json({ error: '最多同时运行 4 个不同工作目录' }, 409); const run = await kernel.start(runRequestSchema.parse(await c.req.json())); return c.json(run, 201); });
  app.get('/api/runs/:id', c => c.json(store.get(c.req.param('id'))));
  app.post('/api/runs/:id/cancel', c => { kernel.cancel(c.req.param('id')); return c.json({ ok: true }); });
  app.post('/api/runs/:id/resume', async c => { const { action, confirmed } = z.object({ action: z.enum(['continue', 'retry', 'skip']), confirmed: z.literal(true) }).parse(await c.req.json()); return c.json(await kernel.resume(c.req.param('id'), action)); });
  app.get('/api/runs/:id/export', c => { c.header('Content-Disposition', `attachment; filename="ramune-${c.req.param('id')}.json"`); return c.json(store.get(c.req.param('id'))); });
  app.get('/api/runs/:id/events', c => {
    const run = store.get(c.req.param('id'));
    let after = Number(c.req.header('last-event-id') || c.req.query('after') || 0);
    if (!Number.isSafeInteger(after) || after < 0) return c.json({ error: '无效事件游标' }, 400);
    return streamSSE(c, async stream => {
      let stopped = false, heartbeat = Date.now();
      stream.onAbort(() => { stopped = true; });
      while (!stopped) {
        for (const event of run.events.slice(after)) { await stream.writeSSE({ id: String(event.seq), event: 'trace', data: JSON.stringify(event) }); after = event.seq; }
        if (run.status !== 'running') break;
        if (Date.now() - heartbeat > 15000) { await stream.writeSSE({ event: 'heartbeat', data: '{}' }); heartbeat = Date.now(); }
        await stream.sleep(300);
      }
    });
  });
  const clientDir = options.clientDir || resolve('dist/client');
  app.get('/', async c => { setCookie(c, cookie, token, { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 86400 }); c.header('Cache-Control', 'no-store'); return c.html(await readFile(join(clientDir, 'index.html'), 'utf8')); });
  app.use('/*', serveStatic({ root: clientDir.replaceAll('\\', '/') }));
  app.notFound(c => c.json({ error: '资源不存在' }, 404));
  return { app, kernel, store };
}
