import { openSync, writeSync, closeSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { zstdDecompressSync } from 'node:zlib';
import type { Emit } from './agents.js';

// 仅导出此 invocation 的私有 OpenClaw 状态；不读取运行中的主 Gateway 数据库。
export async function exportOpenClawTranscript(stateDir: string, emit: Emit, redactValue: (value: unknown) => unknown) {
  const path = join(stateDir, 'agents', 'main', 'agent', 'openclaw-agent.sqlite');
  try { await stat(path); } catch { throw new Error('OpenClaw 未保存可观察的原生 transcript；原始 CLI 日志已保留'); }
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path, { readOnly: true });
  const target = join(stateDir, 'native-transcript.jsonl'), fd = openSync(target, 'w', 0o600), hash = createHash('sha256');
  let count = 0, bytes = 0;
  try {
    for (const row of db.prepare('SELECT session_id, seq, event_json, event_zstd FROM transcript_events ORDER BY session_id, seq').iterate()) {
      const text = typeof row.event_json === 'string' ? row.event_json : row.event_zstd instanceof Uint8Array ? zstdDecompressSync(row.event_zstd).toString('utf8') : undefined;
      if (!text) throw new Error('OpenClaw transcript 编码不可识别，不能宣称工具追踪完整');
      const line = Buffer.from(text + '\n'); bytes += line.length;
      if (bytes > 64 * 1024 * 1024) throw new Error('原生 transcript 超过 64 MiB，已保留 SQLite 状态，运行未通过');
      writeSync(fd, line); hash.update(line); count++;
      emit('agent.event', { type: 'openclaw.transcript', sessionId: row.session_id, nativeSeq: row.seq, record: redactValue(JSON.parse(text)) });
    }
  } finally { closeSync(fd); db.close(); }
  const artifact = { path: target, bytes, sha256: hash.digest('hex'), records: count, source: 'openclaw-sqlite-transcript_events' };
  emit('agent.native_artifact', artifact);
  return artifact;
}
