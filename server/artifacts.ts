import { createWriteStream, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { finished } from 'node:stream/promises';
import type { Readable } from 'node:stream';

export function captureRaw(dir: string, name: string, stop: () => void, maxBytes = 64 * 1024 * 1024) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.log`), fd = openSync(path, 'w', 0o600), file = createWriteStream(path, { fd });
  const hash = createHash('sha256');
  let error: Error | undefined, bytes = 0, truncated = false;
  file.on('error', failure => { error = failure; stop(); });
  const done = finished(file).catch(failure => { error = failure; });
  return {
    attach(stream: Readable | null) {
      stream?.on('data', chunk => {
        if (truncated) return;
        bytes += chunk.length; hash.update(chunk);
        if (!file.write(chunk)) { stream.pause(); file.once('drain', () => stream.resume()); }
        if (bytes > maxBytes) { truncated = true; error = new Error(`原始 ${name} 日志超过 ${maxBytes} 字节预算，已停止执行；原始文件保留已接收前缀`); stop(); }
      });
    },
    async finish() {
      file.end(); await done;
      return { path, bytes, sha256: hash.digest('hex'), truncated, ...(error ? { error: error.message } : {}) };
    },
  };
}
export function writeArtifactManifest(dir: string, manifest: unknown) {
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
}
