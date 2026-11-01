import { execa } from 'execa';
import { access, readdir, readFile, mkdir } from 'node:fs/promises';
import { constants, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { createInterface } from 'node:readline';
import type { AgentInfo, CardData } from '../shared/schema.js';
import { captureRaw, writeArtifactManifest } from './artifacts.js';
import { exportOpenClawTranscript } from './native-transcript.js';

export async function which(name: string): Promise<string | undefined> {
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const dir of (process.env.PATH || '').split(delimiter)) for (const ext of extensions) {
    const path = join(dir.replace(/^"|"$/g, ''), name + ext);
    try { await access(path, process.platform === 'win32' ? constants.F_OK : constants.X_OK); return path; } catch { /* 下一个路径 */ }
  }
  return undefined;
}
export async function discoverAgents(): Promise<AgentInfo[]> {
  return Promise.all([['codex', 'Codex'], ['claude', 'Claude Code'], ['openclaw', 'OpenClaw'], ['gemini', 'Gemini CLI'], ['opencode', 'OpenCode']].map(async ([id, name]) => {
    const path = await which(id);
    if (!path) return { id, name, installed: false, supported: ['codex', 'claude', 'openclaw'].includes(id), auth: 'unknown', detail: '当前服务的 PATH 中未找到可执行文件' } as AgentInfo;
    let version = '版本未知', auth: AgentInfo['auth'] = 'unknown', detail = '已发现；执行时由原生 Harness 检查权限与凭据';
    try { const r = await execa(path, ['--version'], { timeout: 8000, windowsHide: true, reject: false }); version = r.stdout.trim().slice(0, 200); } catch { /* 诊断失败仍保留已发现路径 */ }
    if (id === 'codex') {
      try { const r = await execa(path, ['login', 'status'], { timeout: 8000, reject: false, windowsHide: true }); auth = r.exitCode === 0 ? 'ready' : 'required'; detail = auth === 'ready' ? '原生 Codex 登录检查通过' : '请在此环境运行 codex login'; } catch { detail = '登录检查超时，状态未知'; }
    }
    if (id === 'claude') {
      try { const r = await execa(path, [...claudeSettingsArgs(), 'auth', 'status'], { timeout: 12000, reject: false, windowsHide: true }); const status = JSON.parse(r.stdout); auth = status.loggedIn ? 'ready' : 'required'; detail = auth === 'ready' ? process.env.RAMUNE_CLAUDE_SETTINGS_FILE ? '已配置 CLI Proxy，本地凭据检查通过；有效性由真实调用验证' : '原生 Claude Code 登录检查通过' : '请配置网关凭据或在此环境运行 claude auth login'; } catch { detail = '原生认证检查不可用，状态未知'; }
    }
    if (id === 'openclaw') detail = '已发现原生 OpenClaw；使用隔离 agent exec，模型凭据有效性由真实运行验证';
    return { id, name, path, installed: true, supported: ['codex', 'claude', 'openclaw'].includes(id), version, auth, detail } as AgentInfo;
  }));
}

const secrets = Object.entries(process.env).filter(([k, v]) => /(?:KEY|TOKEN|SECRET|PASSWORD)/i.test(k) && v && v.length >= 8).map(([,v]) => v!);
function claudeSettingsArgs(): string[] {
  const path = process.env.RAMUNE_CLAUDE_SETTINGS_FILE;
  if (!path) return [];
  const settings = JSON.parse(readFileSync(path, 'utf8'));
  for (const [key, value] of Object.entries(settings.env || {})) if (/(?:KEY|TOKEN|SECRET|PASSWORD)/i.test(key) && typeof value === 'string' && value.length >= 6 && !secrets.includes(value)) secrets.push(value);
  return ['--settings', path];
}
export function redact(text: string) {
  for (const value of secrets) text = text.split(value).join('[REDACTED]');
  return text.replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|(?:Bearer\s+)[A-Za-z0-9_.-]{16,})\b/g, '[REDACTED]');
}
export type Emit = (type: string, data: unknown) => void;
export interface ProcessOptions { artifactDir?: string; protocol?: 'jsonl' | 'openclaw' }
function safeValue(value: any): any {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(safeValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, safeValue(item)]));
  return value;
}
export async function runProcess(executable: string, args: string[], cwd: string, signal: AbortSignal, timeout: number, emit: Emit, input?: string, json = false, options: ProcessOptions = {}) {
  if (signal.aborted) throw new Error('运行已取消');
  let spawned: ReturnType<typeof execa> | undefined;
  const raw: ReturnType<typeof captureRaw>[] = [];
  try {
    if (options.artifactDir) for (const name of ['stdout', 'stderr']) raw.push(captureRaw(options.artifactDir, name, () => { spawned?.kill('SIGTERM'); }));
  } catch (error) { await Promise.all(raw.map(capture => capture.finish())); throw error; }
  let child: ReturnType<typeof execa>;
  try { child = spawned = execa(executable, args, { cwd, input, cancelSignal: signal, timeout, reject: false, buffer: false, windowsHide: true, forceKillAfterDelay: 2000, killDescendants: true, cleanup: true }); }
  catch (error) { await Promise.all(raw.map(capture => capture.finish())); throw error; }
  raw[0]?.attach(child.stdout); raw[1]?.attach(child.stderr);
  const resultPromise = child.catch(error => { throw error; });
  // 消费过程中立即注册 rejection handler，避免输出循环尚未结束时产生未处理拒绝。
  void resultPromise.catch(() => undefined);
  let output = '', sessionId: string | undefined, providerError: string | undefined, transientError: string | undefined, turnCompleted = false, document = '';
  const consume = async (stream: NodeJS.ReadableStream | null, stderr: boolean) => {
    if (!stream) return;
    const lines = createInterface({ input: stream });
    for await (const line of lines) {
      const safe = redact(line);
      if (!stderr && options.protocol === 'openclaw') {
        document += line + '\n';
        if (Buffer.byteLength(document) > 4 * 1024 * 1024) throw new Error('OpenClaw 协议文档超过 4 MiB，完整原始输出已保存，运行未通过');
        continue;
      }
      let value: any;
      try { value = json && !stderr ? JSON.parse(line) : undefined; } catch { /* 非 JSON 仍显示原始行 */ }
      if (value) {
        value = safeValue(value);
        sessionId = value.thread_id || value.session_id || sessionId;
        emit('agent.event', value);
        if (value.type === 'error') transientError = value.message || value.error?.message || 'Harness 返回错误';
        if (value.type === 'turn.completed' || value.type === 'result' && !value.is_error) turnCompleted = true;
        if (value.type === 'turn.failed' || value.type === 'assistant' && value.error || value.type === 'result' && value.is_error) providerError = typeof value.error === 'string' ? value.error : value.error?.message || value.result || 'Harness 返回执行错误';
        const text = value.item?.type === 'agent_message' ? value.item.text : value.type === 'assistant' ? value.message?.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n') : value.type === 'result' ? value.result : undefined;
        if (text) output = (output + '\n' + text).slice(-32000);
        if (value.type === 'error' || value.type === 'turn.failed') output = (output + '\n' + JSON.stringify(value)).slice(-32000);
      } else { emit(stderr ? 'process.stderr' : 'process.stdout', { text: safe.slice(0, 32768), truncated: line.length > 32768 }); if (!json || !stderr) output = (output + '\n' + safe).slice(-32000); }
    }
  };
  let consumeError: unknown;
  try { await Promise.all([consume(child.stdout, false), consume(child.stderr, true)]); }
  catch (error) { child.kill('SIGTERM'); await resultPromise.catch(() => undefined); consumeError = error; }
  const result = await resultPromise;
  const captures = await Promise.all(raw.map(capture => capture.finish()));
  if (options.artifactDir) {
    const manifest = { stdout: captures[0], stderr: captures[1], exitCode: result.exitCode, cancelled: signal.aborted, timedOut: result.timedOut };
    writeArtifactManifest(options.artifactDir, manifest);
    if (!consumeError) emit('process.artifacts', manifest);
  }
  const captureError = captures.find(capture => capture.error)?.error;
  if (captureError) throw new Error(captureError);
  if (consumeError) throw consumeError;
  if (options.protocol === 'openclaw') {
    let value: any;
    try { value = safeValue(JSON.parse(document)); } catch { throw new Error('OpenClaw 未返回有效 JSON envelope，不能宣称执行成功；请检查原始 stdout'); }
    emit('agent.event', { type: 'openclaw.result', ...value });
    sessionId = value.sessionId;
    output = value.final || value.payloads?.map((p: any) => p.text || '').join('\n') || value.error?.message || '';
    turnCompleted = value.ok === true && value.status === 'ok';
    if (!turnCompleted) providerError = value.error?.message || `OpenClaw 返回 ${value.status || '未知状态'}`;
  }
  if (signal.aborted || result.isCanceled) throw new Error('运行已取消');
  if (result.timedOut) throw new Error('节点执行超时，副作用可能已经发生');
  if (result.failed && result.exitCode === undefined) throw new Error(redact(result.shortMessage || '无法启动进程'));
  const finalError = providerError || (!turnCompleted ? transientError : undefined);
  return { output: (finalError ? `${finalError}\n${output}` : output).trim(), exitCode: finalError ? 1 : result.exitCode ?? 1, sessionId };
}
export async function runAgent(data: CardData, prompt: string, cwd: string, signal: AbortSignal, timeout: number, emit: Emit, options: ProcessOptions = {}) {
  const path = await which(data.agentId!);
  if (!path) throw new Error(`${data.agentId} 未安装到当前服务 PATH`);
  let args: string[];
  if (data.agentId === 'codex') args = ['--no-daemon', '-a', 'never', 'exec', '--json', '--color', 'never', '--skip-git-repo-check', '--sandbox', 'workspace-write', ...(data.model ? ['--model', data.model] : []), '-'];
  else if (data.agentId === 'claude') {
    const configuredModel = process.env.RAMUNE_CLAUDE_SETTINGS_FILE ? JSON.parse(readFileSync(process.env.RAMUNE_CLAUDE_SETTINGS_FILE, 'utf8')).model : undefined;
    const model = data.model || configuredModel;
    args = [...claudeSettingsArgs(), '-p', '--verbose', '--output-format', 'stream-json', '--permission-mode', 'acceptEdits', ...(model ? ['--model', model] : [])];
  } else {
    if (!options.artifactDir) throw new Error('OpenClaw 需要独立状态与日志目录');
    const stateDir = join(options.artifactDir, 'openclaw-state');
    await mkdir(stateDir, { recursive: true, mode: 0o700 });
    if (process.env.RAMUNE_OPENCLAW_CONFIG_FILE) {
      const cfg = JSON.parse(readFileSync(process.env.RAMUNE_OPENCLAW_CONFIG_FILE, 'utf8'));
      for (const provider of Object.values(cfg.models?.providers || {}) as any[]) if (typeof provider.apiKey === 'string' && provider.apiKey.length >= 6 && !secrets.includes(provider.apiKey)) secrets.push(provider.apiKey);
    }
    args = ['agent', 'exec', '--json', '--message-file', '-', '--cwd', cwd, '--state-dir', stateDir, '--timeout', String(Math.max(1, Math.ceil(timeout / 1000))), ...(process.env.RAMUNE_OPENCLAW_CONFIG_FILE ? ['--config', process.env.RAMUNE_OPENCLAW_CONFIG_FILE] : []), ...(data.model ? ['--model', data.model] : [])];
  }
  emit('agent.command', { executable: path, args, cwd, permission: data.agentId === 'codex' ? 'workspace-write / never' : data.agentId === 'claude' ? 'acceptEdits（额外命令遵循原生权限）' : '原生隔离 agent exec；不投递外部频道' });
  const result = await runProcess(path, args, cwd, signal, timeout, emit, prompt, true, { ...options, protocol: data.agentId === 'openclaw' ? 'openclaw' : 'jsonl' });
  if (data.agentId === 'openclaw') await exportOpenClawTranscript(join(options.artifactDir!, 'openclaw-state'), emit, safeValue);
  return result;
}
