import { readFile, writeFile } from 'node:fs/promises';
const [path, base] = process.argv.slice(2);
const settings = JSON.parse(await readFile(path, 'utf8'));
settings.env.ANTHROPIC_BASE_URL = base;
await writeFile(path, JSON.stringify(settings, null, 2), { mode: 0o600 });
console.log(`Claude Code 已连接已有 CLI Proxy：${base}`);
