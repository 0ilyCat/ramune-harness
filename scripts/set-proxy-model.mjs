import { readFile, writeFile } from 'node:fs/promises';
const [path, model] = process.argv.slice(2);
if (!model) throw new Error('需要明确模型标识符');
const settings = JSON.parse(await readFile(path, 'utf8'));
settings.model = model;
for (const key of ['ANTHROPIC_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL']) settings.env[key] = model;
await writeFile(path, JSON.stringify(settings, null, 2), { mode: 0o600 });
console.log(`本应用的 CLI Proxy 模型已设置为 ${model}`);
