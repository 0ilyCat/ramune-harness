import { mkdirSync, readdirSync, readFileSync, openSync, writeSync, fsyncSync, closeSync, renameSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import type { RunRecord, TraceEvent, Workflow } from '../shared/schema.js';

export function atomicJson(path: string, value: unknown) {
  const tmp = `${path}.tmp`;
  const fd = openSync(tmp, 'w', 0o600);
  try { writeSync(fd, JSON.stringify(value, null, 2)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(tmp, path);
}
export class Store {
  readonly runs = new Map<string, RunRecord>();
  readonly changes = new EventEmitter();
  constructor(readonly dir: string) {
    mkdirSync(join(dir, 'runs'), { recursive: true });
    for (const file of readdirSync(join(dir, 'runs')).filter(f => f.endsWith('.json'))) {
      const run = JSON.parse(readFileSync(join(dir, 'runs', file), 'utf8')) as RunRecord;
      this.runs.set(run.id, run);
      if (run.status === 'running') {
        run.status = 'interrupted';
        run.error = '服务中断；请检查工作目录与最后一次调用，再选择恢复方式。';
        const active = run.invocations.find(i => i.id === run.activeInvocationId);
        if (active?.status === 'started') active.status = 'unknown';
        this.event(run, 'run.interrupted', { message: run.error });
      }
    }
  }
  save(run: RunRecord) {
    run.updatedAt = new Date().toISOString();
    atomicJson(join(this.dir, 'runs', `${run.id}.json`), run);
    this.runs.set(run.id, run);
  }
  event(run: RunRecord, type: string, data: unknown, nodeId?: string, invocationId?: string): TraceEvent {
    const terminal = ['run.interrupted', 'run.failed', 'run.cancelled', 'run.exhausted', 'run.completed'].includes(type);
    if (run.events.length >= 10000 && !terminal) throw new Error('事件预算耗尽（10000），请缩小任务范围');
    const event = { seq: run.events.length + 1, time: new Date().toISOString(), type, data, nodeId, invocationId };
    run.events.push(event);
    this.save(run);
    appendFileSync(join(this.dir, 'runs', `${run.id}.events.jsonl`), JSON.stringify(event) + '\n', { mode: 0o600 });
    this.changes.emit(run.id, event);
    this.changes.emit('trace', { runId: run.id, event });
    return event;
  }
  get(id: string) { const run = this.runs.get(id); if (!run) throw new Error('运行不存在'); return run; }
  list() { return [...this.runs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(({ events, invocations, context, request, ...r }) => ({ ...r, name: request.workflow.name, prompt: request.prompt, invocationCount: invocations.length })); }
  saveWorkflow(workflow: Workflow) { atomicJson(join(this.dir, 'workflow.json'), workflow); }
  loadWorkflow(): Workflow | undefined { try { return JSON.parse(readFileSync(join(this.dir, 'workflow.json'), 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return; throw e; } }
}
