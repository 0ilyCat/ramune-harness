---
status: accepted
date: 2026-10-25
---

# 由原生 Harness 拥有内部工具循环

用户将首版目标明确为现有 Agent Harness 的统一编排器，因此采用 CLI 流式协议把 Codex 与 Claude Code 作为组合执行节点接入。Ramune 内核负责节点顺序、显式交接、失败路由、预算及调用边界 Checkpoint；Harness 拥有模型、内部工具循环、权限与 Session。内部工具原始事件关联到外层 invocation 展示，不能宣称这些工具由图上的独立 Tool 节点控制。

这将 ADR-0002 的独立能力连接作为未来可扩展能力，首版仅实现执行连接；不再为同一个 Harness 重写模型或工具执行循环。每次卡片激活创建独立 Session，上一结果显式进入 Prompt，遵守 ADR-0003 的上下文边界。中断后的 Session 内部副作用未知，恢复遵守 ADR-0004，需要用户核查并明确重试或跳过，不提供恰好一次保证。
