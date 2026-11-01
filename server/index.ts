import { serve } from '@hono/node-server';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { acquireDataLock } from './lock.js';

const port = Number(process.env.PORT || 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT 必须在 1024 至 65535 之间');
const dir = resolve(process.env.RAMUNE_DATA_DIR || '.ramune');
const releaseLock = acquireDataLock(dir); process.once('exit', releaseLock);
const { app, kernel, store } = createApp({ dir, port });
store.changes.on('trace', ({ runId, event }) => {
  if (!/^(run\.|invocation\.|check\.(command|result)|review\.|process\.artifacts|agent\.(command|result))/.test(event.type)) return;
  const data = event.data || {};
  console.log(JSON.stringify({ time: event.time, level: /failed|interrupted|lock_lost/.test(event.type) ? 'error' : data.outcome === 'failure' ? 'warn' : 'info', event: event.type, runId, nodeId: event.nodeId, invocationId: event.invocationId, seq: event.seq, outcome: data.outcome, exitCode: data.exitCode, sessionId: data.sessionId, error: data.error, trace: `runs/${runId}.events.jsonl` }));
});
const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, () => console.log(JSON.stringify({ time: new Date().toISOString(), level: 'info', event: 'server.started', url: `http://127.0.0.1:${port}`, pid: process.pid, node: process.version })));
let stopping = false;
function stop() {
  if (stopping) return; stopping = true;
  for (const controller of kernel.active.values()) controller.abort();
  server.close();
  const timer = setInterval(() => { if (!kernel.active.size) { clearInterval(timer); process.exit(0); } }, 100);
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on('SIGINT', stop); process.on('SIGTERM', stop);
