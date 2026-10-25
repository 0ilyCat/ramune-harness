import { test, expect } from 'vitest';
import { runProcess } from '../server/agents';
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
