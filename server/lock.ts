import { mkdirSync, openSync, writeSync, fsyncSync, closeSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function acquireDataLock(dir: string) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'server.lock'), identity = randomUUID();
  let fd: number;
  try { fd = openSync(path, 'wx', 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    if (!Number.isSafeInteger(saved.pid) || saved.pid <= 0) throw new Error('数据目录锁无效，请先人工检查 server.lock');
    let alive = true;
    try { process.kill(saved.pid, 0); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ESRCH') alive = false; }
    if (alive) throw new Error(`数据目录已有进程使用（PID ${saved.pid}），请使用其他 RAMUNE_DATA_DIR`);
    unlinkSync(path); fd = openSync(path, 'wx', 0o600);
  }
  writeSync(fd, JSON.stringify({ pid: process.pid, identity, createdAt: new Date().toISOString() })); fsyncSync(fd); closeSync(fd);
  return () => { try { if (JSON.parse(readFileSync(path, 'utf8')).identity === identity) unlinkSync(path); } catch { /* 不删除其他进程的锁 */ } };
}
