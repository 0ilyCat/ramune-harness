import { writeFile, mkdir, chmod } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const target = resolve(process.argv[2] || '.ramune/claude-settings.json');
const base = process.env.RAMUNE_PROXY_BASE_URL, key = process.env.RAMUNE_PROXY_API_KEY;
if (!base || !key) throw new Error('需要 RAMUNE_PROXY_BASE_URL 与 RAMUNE_PROXY_API_KEY；凭据不作为命令行参数传递');
const model = process.env.RAMUNE_PROXY_MODEL || 'claude-sonnet-5-5-high';
const settings = { env: {
  ANTHROPIC_BASE_URL: base.replace(/\/v1\/?$/, '').replace(/\/$/, ''), ANTHROPIC_AUTH_TOKEN: key,
  ANTHROPIC_API_KEY: '', CLAUDE_CODE_OAUTH_TOKEN: '',
  ANTHROPIC_DEFAULT_SONNET_MODEL: model, ANTHROPIC_DEFAULT_OPUS_MODEL: model, ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', API_TIMEOUT_MS: '180000',
}, model };
await mkdir(dirname(target), { recursive: true }); await writeFile(target, JSON.stringify(settings, null, 2), { mode: 0o600 }); await chmod(target, 0o600);
const r = await fetch(`${settings.env.ANTHROPIC_BASE_URL}/v1/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
console.log(JSON.stringify({ settingsFile: target, base: settings.env.ANTHROPIC_BASE_URL, catalogStatus: r.status, model }));
if (!r.ok) process.exitCode = 1;
