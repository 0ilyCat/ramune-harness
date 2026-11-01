import { z } from 'zod';

export const nodeSchema = z.object({
  id: z.string().min(1).max(80), type: z.literal('card').default('card'),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  data: z.object({
    label: z.string().min(1).max(100), kind: z.enum(['agent', 'check', 'value', 'output']),
    agentId: z.enum(['codex', 'claude', 'openclaw']).optional(), role: z.enum(['builder', 'reviewer']).optional(),
    instructions: z.string().max(12000).default(''), model: z.string().max(100).optional(),
    executable: z.string().max(500).optional(), args: z.array(z.string().max(4000)).max(80).optional(),
    disabled: z.boolean().default(false),
  }),
});
export const workflowSchema = z.object({
  version: z.literal(1), name: z.string().min(1).max(100), entry: z.string().min(1),
  nodes: z.array(nodeSchema).min(1).max(50),
  edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string(), sourceHandle: z.enum(['success', 'failure']).default('success'), targetHandle: z.string().nullable().optional() })).max(100),
});
export type Workflow = z.infer<typeof workflowSchema>;
export type CardData = Workflow['nodes'][number]['data'];
export const runRequestSchema = z.object({
  workflow: workflowSchema, prompt: z.string().min(1).max(24000), workspace: z.string().min(1).max(2000),
  maxSteps: z.number().int().min(1).max(100).default(12), timeoutSeconds: z.number().int().min(10).max(7200).default(900),
  authorized: z.literal(true),
});
export type RunRequest = z.infer<typeof runRequestSchema>;
export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted' | 'exhausted';
export interface TraceEvent { seq: number; time: string; type: string; nodeId?: string; invocationId?: string; data: unknown }
export interface Invocation { id: string; nodeId: string; step: number; status: 'started' | 'completed' | 'failed' | 'unknown'; startedAt: string; finishedAt?: string; output?: string; outcome?: 'success' | 'failure'; sessionId?: string; artifactDir?: string }
export interface RunRecord {
  id: string; status: RunStatus; createdAt: string; updatedAt: string; request: RunRequest; revision: string;
  nextNodeId?: string; activeInvocationId?: string; steps: number; invocations: Invocation[]; events: TraceEvent[]; context: string; error?: string;
}
export interface AgentInfo { id: string; name: string; installed: boolean; supported: boolean; path?: string; version?: string; auth: 'ready' | 'required' | 'unknown'; detail: string }

export function validateGraph(workflow: Workflow) {
  const ids = new Set(workflow.nodes.map(n => n.id));
  if (ids.size !== workflow.nodes.length) throw new Error('节点 ID 重复');
  if (!ids.has(workflow.entry)) throw new Error('入口节点不存在');
  const routes = new Set<string>();
  for (const edge of workflow.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) throw new Error('连接引用了不存在的节点');
    const key = `${edge.source}:${edge.sourceHandle}`;
    if (routes.has(key)) throw new Error('同一个结果端口只能有一条执行连接');
    routes.add(key);
  }
  for (const n of workflow.nodes) {
    if (n.data.kind === 'agent' && !n.data.agentId) throw new Error('Agent 节点必须选择 Harness');
    if (n.data.kind === 'check' && !n.data.executable) throw new Error('检查节点必须配置 executable');
  }
  const reachable = new Set<string>();
  const visit = (id: string) => { if (reachable.has(id)) return; reachable.add(id); workflow.edges.filter(e => e.source === id).forEach(e => visit(e.target)); };
  visit(workflow.entry);
  if (reachable.size !== ids.size) throw new Error('存在未连接到入口的节点');
}

export function template(agentId: NonNullable<CardData['agentId']> = 'codex'): Workflow {
  return workflowSchema.parse({ version: 1, name: '左右脑 · 构建与验收', entry: 'builder', nodes: [
    { id: 'builder', position: { x: 30, y: 130 }, data: { label: '左脑 · 构建者', kind: 'agent', agentId, role: 'builder', instructions: '实现用户需求，检查当前文件并写入真实代码。若有失败反馈，先修复再执行测试。结束时交接修改与验证结果。' } },
    { id: 'reviewer', position: { x: 360, y: 130 }, data: { label: '右脑 · 审查者', kind: 'agent', agentId, role: 'reviewer', instructions: '独立审查代码和测试覆盖，真实执行检查。发现问题请修复并再次验证，明确报告验收结果和剩余问题。' } },
    { id: 'check', position: { x: 360, y: 350 }, data: { label: '独立测试', kind: 'check', instructions: '', executable: 'node', args: ['--test'] } },
    { id: 'done', position: { x: 30, y: 350 }, data: { label: '交付结果', kind: 'output', instructions: '' } },
  ], edges: [
    { id: 'e1', source: 'builder', target: 'reviewer', sourceHandle: 'success' },
    { id: 'e2', source: 'reviewer', target: 'check', sourceHandle: 'success' },
    { id: 'e3', source: 'check', target: 'done', sourceHandle: 'success' },
    { id: 'e4', source: 'check', target: 'builder', sourceHandle: 'failure' },
    { id: 'e5', source: 'reviewer', target: 'builder', sourceHandle: 'failure' },
  ] });
}
