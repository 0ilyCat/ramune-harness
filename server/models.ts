import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function modelCatalog(dataDir: string) {
  let config: any, provider: string | undefined;
  if (process.env.RAMUNE_OPENCLAW_CONFIG_FILE) {
    const file = JSON.parse(await readFile(process.env.RAMUNE_OPENCLAW_CONFIG_FILE, 'utf8'));
    const entry = Object.entries(file.models?.providers || {}).find(([, value]: any) => value.baseUrl);
    if (entry) { provider = entry[0]; const value = entry[1] as any; config = { baseUrl: value.baseUrl, apiKey: value.apiKey }; }
  } else if (process.env.RAMUNE_CLAUDE_SETTINGS_FILE) {
    const file = JSON.parse(await readFile(process.env.RAMUNE_CLAUDE_SETTINGS_FILE, 'utf8'));
    config = { baseUrl: file.env?.ANTHROPIC_BASE_URL, apiKey: file.env?.ANTHROPIC_AUTH_TOKEN || file.env?.ANTHROPIC_API_KEY };
  } else {
    try { config = JSON.parse(await readFile(join(dataDir, 'proxy-settings.json'), 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  if (!config?.baseUrl || typeof config.apiKey !== 'string') return { configured: false, models: [] };
  const base = config.baseUrl.replace(/\/$/, ''), url = base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${config.apiKey}` }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`CLIProxy 模型目录 HTTP ${response.status}`);
  const value = await response.json() as { data: { id: string }[] };
  const models = value.data.map(model => ({ id: model.id, ...(provider ? { openclawId: `${provider}/${model.id}` } : {}) }));
  return { configured: true, models, requested: ['gemini-4-argon-high', 'gemini-3.8-flash-high', 'claude-opus-5-5-high'].map(id => ({ id, configured: models.some(model => model.id === id) })) };
}
