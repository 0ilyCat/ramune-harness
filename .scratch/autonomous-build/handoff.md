# 持久化交接

更新时间：2026-11-01，Asia/Shanghai。

首版实现及最终审查已交付；最新状态以 [最终验收交接](../final-qa-20261101/handoff.md) 和 [三环境验收报告](../../docs/qa/2026-11-01.md) 为准。旧记录中的 577c6f88 不是当前活动运行。

仓库为 `D:\projects\myproject\ramune-harness`，远程为 `https://github.com/0ilyCat/ramune-harness.git`。Windows 页面 4317、WSL 页面 4318；私有数据保留，不提交凭据。

Windows / WSL 浏览器各 4/4，三环境单元与真实进程回归各 20/20，服务器两个 OpenClaw 卡片五轮 completed。WSL 额外原生编程受 429 配额限制，Windows 额外专用凭据实例被自动审批拒绝；不能宣称全部原生模型路径通过。2026-10-25 的 Windows 双 Codex completed 属于历史验收。

原始证据、失败尝试、SHA-256 清单及 ZIP 位于 `docs/qa/evidence/`；共享代理监听风险按用户指示保留。后续不重启或改写用户共享代理，不发送外部消息。
