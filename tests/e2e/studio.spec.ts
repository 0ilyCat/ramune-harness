import { test, expect } from '@playwright/test';
import { template } from '../../shared/schema';
let originalWorkflow: unknown;
test.beforeEach(async ({ page }) => { await page.goto('/'); originalWorkflow = await (await page.request.get('/api/workflow')).json(); });
test.afterEach(async ({ page }) => { if (originalWorkflow) await page.request.put('/api/workflow', { data: originalWorkflow }); });
test('慢速真实初始化响应不会覆盖刚添加的节点', async ({ page }) => {
  let release!: () => void;
  const delayed = new Promise<void>(r => { release = r; });
  // 只延迟真实服务器响应，数据与执行均来自实际服务。
  await page.route('**/api/workflow', async route => { const response = await route.fetch(); await delayed; await route.fulfill({ response }); });
  await page.goto('/');
  const ready = page.waitForResponse(r => r.url().includes('/api/agents?refresh=1'));
  const adding = page.getByRole('button', { name: '添加value', exact: true }).click();
  await page.waitForTimeout(300); release(); await ready; await adding;
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.react-flow__node')).toHaveCount(5);
});
test('画布可拖动、节点库可添加、配置及撤销重做', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.bootstrap-overlay')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '左右脑 · 构建与验收' })).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  const builder = page.locator('.react-flow__node[data-id="builder"]');
  const before = await builder.getAttribute('style');
  const bounds = (await builder.locator('.card-title').boundingBox())!;
  await page.mouse.move(bounds.x + 60, bounds.y + 15); await page.mouse.down(); await page.mouse.move(bounds.x + 100, bounds.y - 30, { steps: 12 }); await page.mouse.up();
  expect(await builder.getAttribute('style')).not.toBe(before);
  await page.getByRole('button', { name: '添加value', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(5);
  await page.getByText('显示名称', { exact: true }).locator('input').fill('新的上下文节点');
  await expect(page.getByText('新的上下文节点', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  // 文本编辑可逐步撤销，节点添加也能撤销。
  for (let i = 0; i < 5 && await page.locator('.react-flow__node').count() > 4; i++) await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  await page.getByRole('button', { name: '重做', exact: true }).click(); await expect(page.locator('.react-flow__node')).toHaveCount(5);
  await expect(page.getByRole('alert')).toHaveCount(0); expect(errors).toEqual([]);
});
test('导入、保存、真实无模型运行、SSE 检查器及历史重载', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.bootstrap-overlay')).toHaveCount(0);
  const workflow = { version: 1, name: '无模型 · 真实进程验收', entry: 'input', nodes: [
    { id: 'input', type: 'card', position: { x: 0, y: 0 }, data: { kind: 'value', label: '显式任务', instructions: '{{prompt}}' } },
    { id: 'check', type: 'card', position: { x: 320, y: 0 }, data: { kind: 'check', label: '真实 Node 检查', executable: 'node', args: ['-e', 'console.log("BROWSER_REAL_PROCESS_OK")'], instructions: '' } },
    { id: 'out', type: 'card', position: { x: 320, y: 260 }, data: { kind: 'output', label: '交付', instructions: '' } },
  ], edges: [{ id: '1', source: 'input', target: 'check', sourceHandle: 'success' }, { id: '2', source: 'check', target: 'out', sourceHandle: 'success' }] };
  await page.locator('input[type=file]').setInputFiles({ name: 'workflow.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(workflow)) });
  await expect(page.getByRole('heading', { name: workflow.name })).toBeVisible();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('已保存');
  await page.getByRole('button', { name: '创建真实验收项目' }).click();
  await expect(page.getByLabel('工作目录', { exact: true })).not.toHaveValue('');
  await page.getByLabel('任务需求').fill('浏览器触发真实确定性执行');
  await page.getByLabel('授权本次工作目录执行').check();
  await page.getByRole('button', { name: '运行工作流' }).click();
  await expect(page.locator('.run-summary')).toContainText('已完成');
  await expect(page.locator('.trace-list')).toContainText('run.completed');
  await page.getByRole('button', { name: '结果', exact: true }).click();
  await page.locator('.trace-row').filter({ hasText: 'check.result' }).click();
  await expect(page.locator('.event-detail')).toContainText('BROWSER_REAL_PROCESS_OK');
  await expect(page.locator('.event-detail')).toContainText('"exitCode": 0');
  await page.reload(); await page.getByRole('button', { name: '运行历史', exact: true }).click();
  await expect(page.locator('.run-table')).toContainText('浏览器触发真实确定性执行');
  await page.locator('.run-table-row').filter({ hasText: '浏览器触发真实确定性执行' }).first().click();
  await expect(page.locator('.run-summary')).toContainText('已完成');
});
test('原生拖入节点与手动端口连接可保存', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.bootstrap-overlay')).toHaveCount(0);
  const simple = { version: 1, name: '手动连线验收', entry: 'a', nodes: [{ id: 'a', type: 'card', position: { x: 30, y: 30 }, data: { kind: 'value', label: '源节点', instructions: '{{prompt}}' } }], edges: [] };
  await page.locator('input[type=file]').setInputFiles({ name: 'simple.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(simple)) });
  const canvas = page.locator('.canvas'); const box = (await canvas.boundingBox())!;
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await transfer.evaluate(d => d.setData('application/ramune', JSON.stringify({ kind: 'output' })));
  await canvas.dispatchEvent('drop', { dataTransfer: transfer, clientX: box.x + box.width - 160, clientY: box.y + box.height - 200 });
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  const source = page.locator('.react-flow__node[data-id="a"] .react-flow__handle.source[data-handleid="success"]');
  const target = page.locator('.react-flow__node').filter({ hasText: '输出结果' }).locator('.react-flow__handle.target');
  const start = (await source.boundingBox())!, end = (await target.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down(); await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 20 }); await page.mouse.up();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('已保存');
});
