import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e', fullyParallel: false, workers: 1,
  timeout: 45000, expect: { timeout: 12000 },
  use: { baseURL: process.env.RAMUNE_E2E_URL || 'http://127.0.0.1:4320', viewport: { width: 1536, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.RAMUNE_E2E_URL ? undefined : { command: 'node dist/server/index.js', url: 'http://127.0.0.1:4320/api/health', env: { PORT: '4320', RAMUNE_DATA_DIR: `.ramune/e2e-${process.pid}-${Date.now()}` }, reuseExistingServer: false, timeout: 20000 },
});
