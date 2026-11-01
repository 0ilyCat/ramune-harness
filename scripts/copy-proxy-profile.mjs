import { readFile, writeFile, chmod } from 'node:fs/promises';
const [source, target, baseUrl, model] = process.argv.slice(2);
const settings = JSON.parse(await readFile(source, 'utf8'));
settings.env.ANTHROPIC_BASE_URL = baseUrl;
settings.model = model;
for (const key of ['ANTHROPIC_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL']) settings.env[key] = model;
await writeFile(target, JSON.stringify(settings, null, 2), { mode: 0o600 }); await chmod(target, 0o600);
console.log(JSON.stringify({ privateProfile: target, baseUrl, model, sourceUnchanged: true }));
