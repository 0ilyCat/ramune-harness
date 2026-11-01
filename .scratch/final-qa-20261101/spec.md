Status: ready-for-agent

# 最终审查与三环境真实验收

2026-11-01 用户要求检查严重缺陷、重新完成 Windows / WSL 端到端验证、确认 CLIProxy 包含 Gemini 4、Gemini 3.8 Flash 和 Opus 5.5，并 SSH 到已有 OpenClaw 的腾讯云服务器，执行两个 OpenClaw 卡片往返五轮，检查日志并提供本次原始输出。用户已明确要求上传 GitHub。

## 验收边界

- 修复严重正确性、恢复与观测缺陷，回归必须能实际失败和通过。
- 模型别名以当前代理目录为准，配置存在与真实可调用分开记录。
- 五轮定义为左、右卡片各调用五次，共十次真实 OpenClaw 调用；检查节点决定正常停止，不以预算耗尽冒充完成。
- 使用服务器已有 OpenClaw / CLIProxy / Mihomo。只监听 loopback，不安装远端 Codex / Antigravity，不触发 Telegram、日报或其他外部消息。
- 在应用独立目录运行，原有服务和主 Agent 配置不被覆盖。测试日志、JSONL 事件、原始 stdout/stderr 和 SHA-256 清单均保存，敏感值若出现须标明遮蔽。
- 修复、脚本、经过敏感检查的证据与报告推送 origin/main。
