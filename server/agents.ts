import { execa } from 'execa';
import { access } from 'node:fs/promises';
import { constants, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { createInterface } from 'node:readline';
import type { AgentInfo, CardData } from '../shared/schema.js';

export async function which(name: string): Promise<string | undefined> {
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const dir of (process.env.PATH || '').split(delimiter)) for (const ext of extensions) {
    const path = join(dir.replace(/^"|"$/g, ''), name + ext);
    try { await access(path, process.platform === 'win32' ? constants.F_OK : constants.X_OK); return path; } catch { /* 下一个路径 */ }
  }
  return undefined;
}
export async function discoverAgents(): Promise<AgentInfo[]> {
  return Promise.all([['codex', 'Codex'], ['claude', 'Claude Code'], ['gemini', 'Gemini CLI'], ['opencode', 'OpenCode']].map(async ([id, name]) => {
    const path = await which(id);
    if (!path) return { id, name, installed: false, supported: ['codex', 'claude'].includes(id), auth: 'unknown', detail: '当前服务的 PATH 中未找到可执行文件' } as AgentInfo;
    let version = '版本未知', auth: AgentInfo['auth'] = 'unknown', detail = '已发现；执行时由原生 Harness 检查权限与凭据';
    try { const r = await execa(path, ['--version'], { timeout: 8000, windowsHide: true, reject: false }); version = r.stdout.trim().slice(0, 200); } catch { /* 诊断失败仍保留已发现路径 */ }
    if (id === 'codex') {
      try { const r = await execa(path, ['login', 'status'], { timeout: 8000, reject: false, windowsHide: true }); auth = r.exitCode === 0 ? 'ready' : 'required'; detail = auth === 'ready' ? '原生 Codex 登录检查通过' : '请在此环境运行 codex login'; } catch { detail = '登录检查超时，状态未知'; }
    }
    if (id === 'claude') {
      try { const r = await execa(path, [...claudeSettingsArgs(), 'auth', 'status'], { timeout: 12000, reject: false, windowsHide: true }); const status = JSON.parse(r.stdout); auth = status.loggedIn ? 'ready' : 'required'; detail = auth === 'ready' ? process.env.RAMUNE_CLAUDE_SETTINGS_FILE ? '已配置 CLI Proxy，本地凭据检查通过；有效性由真实调用验证' : '原生 Claude Code 登录检查通过' : '请配置网关凭据或在此环境运行 claude auth login'; } catch { detail = '原生认证检查不可用，状态未知'; }
    }
    return { id, name, path, installed: true, supported: ['codex', 'claude'].includes(id), version, auth, detail } as AgentInfo;
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
export async function runProcess(executable: string, args: string[], cwd: string, signal: AbortSignal, timeout: number, emit: Emit, input?: string, json = false) {
  if (signal.aborted) throw new Error('运行已取消');
  const child = execa(executable, args, { cwd, input, cancelSignal: signal, timeout, reject: false, buffer: false, windowsHide: true, forceKillAfterDelay: 2000, killDescendants: true, cleanup: true });
  const resultPromise = child.catch(error => { throw error; });
  // 消费过程中立即注册 rejection handler，避免输出循环尚未结束时产生未处理拒绝。
  void resultPromise.catch(() => undefined);
  let output = '', sessionId: string | undefined, providerError: string | undefined, transientError: string | undefined, turnCompleted = false;
  const consume = async (stream: NodeJS.ReadableStream | null, stderr: boolean) => {
    if (!stream) return;
    const lines = createInterface({ input: stream });
    for await (const line of lines) {
      const safe = redact(line).slice(0, 32768);
      let value: any;
      try { value = json && !stderr ? JSON.parse(safe) : undefined; } catch { /* 非 JSON 仍显示原始行 */ }
      if (value) {
        sessionId = value.thread_id || value.session_id || sessionId;
        emit('agent.event', value);
        if (value.type === 'error') transientError = value.message || value.error?.message || 'Harness 返回错误';
        if (value.type === 'turn.completed' || value.type === 'result' && !value.is_error) turnCompleted = true;
        if (value.type === 'turn.failed' || value.type === 'assistant' && value.error || value.type === 'result' && value.is_error) providerError = typeof value.error === 'string' ? value.error : value.error?.message || value.result || 'Harness 返回执行错误';
        const text = value.item?.type === 'agent_message' ? value.item.text : value.type === 'assistant' ? value.message?.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n') : value.type === 'result' ? value.result : undefined;
        if (text) output = (output + '\n' + text).slice(-32000);
        if (value.type === 'error' || value.type === 'turn.failed') output = (output + '\n' + JSON.stringify(value)).slice(-32000);
      } else { emit(stderr ? 'process.stderr' : 'process.stdout', { text: safe, truncated: line.length > 32768 }); if (!json || !stderr) output = (output + '\n' + safe).slice(-32000); }
    }
  };
  try { await Promise.all([consume(child.stdout, false), consume(child.stderr, true)]); }
  catch (error) { child.kill('SIGTERM'); await resultPromise.catch(() => undefined); throw error; }
  const result = await resultPromise;
  if (signal.aborted || result.isCanceled) throw new Error('运行已取消');
  if (result.timedOut) throw new Error('节点执行超时，副作用可能已经发生');
  if (result.failed && result.exitCode === undefined) throw new Error(redact(result.shortMessage || '无法启动进程'));
  const finalError = providerError || (!turnCompleted ? transientError : undefined);
  return { output: (finalError ? `${finalError}\n${output}` : output).trim(), exitCode: finalError ? 1 : result.exitCode ?? 1, sessionId };
}
export async function runAgent(data: CardData, prompt: string, cwd: string, signal: AbortSignal, timeout: number, emit: Emit) {
  const path = await which(data.agentId!);
  if (!path) throw new Error(`${data.agentId} 未安装到当前服务 PATH`);
  let args: string[];
  if (data.agentId === 'codex') args = ['--no-daemon', '-a', 'never', 'exec', '--json', '--color', 'never', '--skip-git-repo-check', '--sandbox', 'workspace-write', ...(data.model ? ['--model', data.model] : []), '-'];
  else {
    const configuredModel = process.env.RAMUNE_CLAUDE_SETTINGS_FILE ? JSON.parse(readFileSync(process.env.RAMUNE_CLAUDE_SETTINGS_FILE, 'utf8')).model : undefined;
    const model = data.model || configuredModel;
    args = [...claudeSettingsArgs(), '-p', '--verbose', '--output-format', 'stream-json', '--permission-mode', 'acceptEdits', ...(model ? ['--model', model] : [])];
  }
  emit('agent.command', { executable: path, args, cwd, permission: data.agentId === 'codex' ? 'workspace-write / never' : 'acceptEdits（额外命令遵循原生权限）' });
  return runProcess(path, args, cwd, signal, timeout, emit, prompt, true);
}
