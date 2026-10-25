# 首版交付与实测记录

日期：2026-10-25，Asia/Shanghai。仓库已迁移至 `D:\projects\myproject\ramune-harness`；以下记录区分真实 Agent 验收、确定性工程检查及待完成事项。

## 已完成范围

React Flow 工作室、真实 Agent 发现、Codex/Claude Code 非交互适配、左右脑循环、独立 Check、Prompt/Session/工具事件检查器、持久运行记录、SSE 重连、取消、调用预算、超时、同目录互斥及确认恢复。具体边界见 README 与 ADR-0005；不宣称提供未实现的能力边、任意插件、并行汇合或组合子图编辑。

## Windows 真实验收

- Codex CLI `0.163.0-alpha.11`，Node `24.19.0`。
- 最终协议运行：`8f7d6388-96d1-4159-928d-4bfe40dcea45`，状态 `completed`。
- 构建 Session：`01a171de-2859-7692-a385-883f68e5b1aa`；审查 Session：`01a171df-743c-7702-9266-968b0dc24b63`。
- Agent 在独立验收目录真实创建 `slugify.js` 并补充测试。审查协议 `RAMUNE_REVIEW: PASS`，独立 `node --test` 退出码 0，14 项通过。
- 较早一次完整验收 `34e82ac7-92bd-488f-8bd0-e4af6cc61b5e` 同样 completed，独立检查 27 项通过。测试数量不同来自两个真实独立项目中的不同补充覆盖，不能当作性能比较。
- 原始证据在私有 `.ramune/evidence/` 与 `.ramune/runs/`，没有用测试替身代替 Agent 执行。

## 工程验证

- TypeScript 类型检查和生产构建通过。
- Vitest：Windows 与 Linux 均 12 项通过，覆盖真实进程、失败循环、预算、取消、未知副作用、恢复及流式错误协议。
- 真实服务强制终止 → 重启 → `interrupted/unknown` → 拒绝自动重放 → 明确确认重试：Windows 与 Linux 均通过。
- 已固定并修复慢速初始化覆盖用户编辑的竞态：真实延迟响应回归先失败（5 个节点变为 4 个），添加初始化保护后通过。
- 生产依赖审计：官方 npm registry 返回 0 个已知漏洞。默认镜像不实现 audit 接口时使用官方 registry，未伪报镜像审计成功。

## 双环境部署

Windows 页面 `http://127.0.0.1:4317`；Ubuntu 页面 `http://127.0.0.1:4318`。Ubuntu 独立安装依赖和构建，`systemd --user` 管理进程，两套私有数据分离。用户提供的 Windows CLI Proxy 已经由 WSL 受限 TCP 转发复用，模型目录 HTTP 200，Anthropic Messages 实际请求 HTTP 200 并返回 `RAMUNE_PROXY_OK`；没有新建另一套模型代理或要求 Claude 账号登录。

## 最终收尾状态

Linux 双 Agent 闭环、两套浏览器完整复验与远端推送正在收尾，最终结果将在验证后补录；不能把上述接口连通性当作完整 Agent 验收。
