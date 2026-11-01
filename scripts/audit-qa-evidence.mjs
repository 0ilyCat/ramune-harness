import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, relative } from 'node:path';
const root = resolve(process.argv[2] || '.ramune/evidence/final-qa-20261101');
const manifest = JSON.parse(await readFile(join(root, 'server-manifest.json'), 'utf8'));
for (const item of manifest) { const bytes = await readFile(join(root, item.path)); assert.equal(bytes.length, item.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.path); }
const record = JSON.parse(await readFile(join(root, 'server/evidence/run-record.json'), 'utf8'));
assert.equal(record.status, 'completed');
const native = record.events.filter(e => e.type === 'agent.event' && e.data.type === 'openclaw.result');
const tools = [...new Set(native.flatMap(e => e.data.toolSummary?.tools || []))];
assert.deepEqual(tools, ['read']); assert.equal(native.length, 10);
assert.ok(native.every(e => e.data.ok && e.data.status === 'ok' && e.data.toolSummary.failures === 0));
const captures = record.events.filter(e => e.type === 'process.artifacts');
assert.equal(captures.length, 15);
const serverRoot = '/home/ubuntu/.local/share/ramune-harness-qa-20261101/';
let rawFilesVerified = 0;
for (const event of captures) for (const stream of ['stdout', 'stderr']) {
  const artifact = event.data[stream]; assert.equal(artifact.truncated, false);
  const bytes = await readFile(join(root, 'server', artifact.path.replace(serverRoot, '')));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), artifact.sha256); rawFilesVerified++;
}
const nativeArtifacts = record.events.filter(e => e.type === 'agent.native_artifact');
assert.equal(nativeArtifacts.length, 10);
for (const event of nativeArtifacts) {
  const bytes = await readFile(join(root, 'server', event.data.path.replace(serverRoot, '')));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), event.data.sha256); rawFilesVerified++;
}
const files = [];
async function walk(dir) { for (const item of await readdir(dir, { withFileTypes: true })) { const path = join(dir, item.name); if (item.isDirectory()) await walk(path); else files.push(path); } }
await walk(root);
const secretPatterns = [/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/, /\bgh[pousr]_[A-Za-z0-9]{30,}/, /\bsk-proj-[A-Za-z0-9_-]{20,}/, /(?:api[_-]?key|auth[_-]?token|authorization)["'\s:=]+(?:Bearer\s+)?123456/i];
const suspicious = [];
for (const path of files.filter(path => !/\.(?:zip|gz|png)$/.test(path))) { const text = await readFile(path, 'utf8'); if (secretPatterns.some(pattern => pattern.test(text))) suspicious.push(relative(root, path)); }
assert.deepEqual(suspicious, [], '证据发现疑似凭据，必须人工检查后才能发布');
const audit = { time: new Date().toISOString(), verifiedServerFiles: manifest.length, verifiedInvocationRawFiles: rawFilesVerified, nativeSessions: native.length, nativeTools: tools, nativeToolCalls: native.reduce((n, e) => n + e.data.toolSummary.calls, 0), terminalStatus: record.status, steps: record.steps, redactionsApplied: 0, secretPatternFiles: suspicious };
await writeFile(join(root, 'audit.json'), JSON.stringify(audit, null, 2)); console.log('QA_EVIDENCE_AUDIT ' + JSON.stringify(audit));
