import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base = process.env.RAMUNE_URL || 'http://127.0.0.1:4317';
await mkdir('.ramune/screenshots', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base); await page.getByText('本地服务已连接', { exact: false }).waitFor();
  await page.locator('.library-card').first().waitFor(); await page.waitForTimeout(1200);
  await page.screenshot({ path: `.ramune/screenshots/studio-${new URL(base).port}.png`, fullPage: true });
  if (process.env.RAMUNE_RUN_ID) {
    await page.getByRole('button', { name: '运行历史', exact: true }).click();
    await page.locator('.run-table-row').filter({ hasText: process.env.RAMUNE_RUN_ID.slice(0, 8) }).click();
    await page.locator('.run-summary').waitFor();
    await page.getByRole('button', { name: '结果', exact: true }).click();
    await page.locator('.trace-row').filter({ hasText: 'check.result' }).last().click();
    await page.screenshot({ path: `.ramune/screenshots/run-${new URL(base).port}.png`, fullPage: true });
  }
  console.log(JSON.stringify({ base, browserErrors: errors }));
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
