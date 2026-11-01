import { test, expect } from 'vitest';
import { runProcess } from '../server/agents';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
test('真实流式进程的重连警告被恢复后，最终 turn.completed 可成功', async () => {
  const values = [{ type: 'error', message: 'Reconnecting... request timed out' }, { type: 'item.completed', item: { type: 'agent_message', text: '真实流式协议检查' } }, { type: 'turn.completed' }];
  const result = await runProcess(process.execPath, ['-e', `for(const v of ${JSON.stringify(values)})console.log(JSON.stringify(v))`], process.cwd(), new AbortController().signal, 5000, () => {}, undefined, true);
  expect(result.exitCode).toBe(0); expect(result.output).toContain('真实流式协议检查');
});
test('即便进程退出 0，最终 turn.failed 仍判为失败', async () => {
  const value = { type: 'turn.failed', error: { message: 'upstream failure' } };
  const result = await runProcess(process.execPath, ['-e', `console.log(JSON.stringify(${JSON.stringify(value)}))`], process.cwd(), new AbortController().signal, 5000, () => {}, undefined, true);
  expect(result.exitCode).toBe(1); expect(result.output).toContain('upstream failure');
});
test('超过展示上限的最终失败仍按完整协议判定，不能降级为成功', async () => {
  const result = await runProcess(process.execPath, ['-e', `console.log(JSON.stringify({type:'turn.failed',error:{message:'PROVIDER_FAILURE_'+'x'.repeat(40000)}}))`], process.cwd(), new AbortController().signal, 5000, () => {}, undefined, true);
  expect(result.exitCode).toBe(1); expect(result.output).toContain('PROVIDER_FAILURE_');
});
test('日志目录初始化失败时不能留下仍修改文件的子进程', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ramune-artifact-init-'));
  try {
    const invalid = join(dir, 'not-a-directory'), marker = join(dir, 'marker'); await writeFile(invalid, 'file');
    await expect(runProcess(process.execPath, ['-e', `setTimeout(()=>require('fs').writeFileSync('marker','bad'),300)`], dir, new AbortController().signal, 5000, () => {}, undefined, false, { artifactDir: invalid })).rejects.toThrow();
    await new Promise(r => setTimeout(r, 600)); await expect(access(marker)).rejects.toThrow();
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('原始 stdout 保留字节与行尾，SHA256 与实际文件一致', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ramune-artifact-bytes-'));
  try {
    await runProcess(process.execPath, ['-e', `process.stdout.write('A\\r\\nB\\n')`], dir, new AbortController().signal, 5000, () => {}, undefined, false, { artifactDir: dir });
    const original = await readFile(join(dir, 'stdout.log')); expect(original.toString()).toBe('A\r\nB\n');
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
    expect(manifest.stdout.sha256).toBe(createHash('sha256').update(original).digest('hex')); expect(manifest.stdout.truncated).toBe(false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('OpenClaw 多行 JSON envelope 按原生状态解析', async () => {
  const envelope = { ok: true, status: 'ok', final: 'native-protocol-fixture', sessionId: 'fixture-session', toolSummary: { calls: 1 } };
  const result = await runProcess(process.execPath, ['-e', `console.log(JSON.stringify(${JSON.stringify(envelope)},null,2))`], process.cwd(), new AbortController().signal, 5000, () => {}, undefined, true, { protocol: 'openclaw' });
  expect(result.exitCode).toBe(0); expect(result.sessionId).toBe('fixture-session'); expect(result.output).toBe('native-protocol-fixture');
});
