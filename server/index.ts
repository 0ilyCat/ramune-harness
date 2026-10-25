import { serve } from '@hono/node-server';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { acquireDataLock } from './lock.js';

const port = Number(process.env.PORT || 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT 必须在 1024 至 65535 之间');
const dir = resolve(process.env.RAMUNE_DATA_DIR || '.ramune');
const releaseLock = acquireDataLock(dir); process.once('exit', releaseLock);
const { app, kernel } = createApp({ dir, port });
const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, () => console.log(`Ramune Harness 已启动：http://127.0.0.1:${port}`));
let stopping = false;
function stop() {
  if (stopping) return; stopping = true;
  for (const controller of kernel.active.values()) controller.abort();
  server.close();
  const timer = setInterval(() => { if (!kernel.active.size) { clearInterval(timer); process.exit(0); } }, 100);
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on('SIGINT', stop); process.on('SIGTERM', stop);
