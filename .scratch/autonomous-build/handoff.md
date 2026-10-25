# 持久化交接

更新时间：2026-10-25。

## 当前阶段

核心与 UI 已实现，正在最终复验和提交。用户已授权研发、双环境部署、测试及推送 origin；无需继续常规访谈。

## 环境

- 仓库 D:\agent-task\ramune-harness；origin https://github.com/0ilyCat/ramune-harness.git；远端当前为空。
- Windows Node 24.19.0、npm 11.17.0；Codex CLI 在 PATH 且 ChatGPT 登录有效。
- WSL Ubuntu-24.04，systemd；Node 在 /home/dwx/.nvm/versions/node/v24.15.0/bin。
- 部署计划：Windows 127.0.0.1:4317，WSL 127.0.0.1:4318，各自数据目录。

## 待完成

## 已验证

- Windows 服务 PID 6704，127.0.0.1:4317，最终协议真实复验运行 `8f7d6388-96d1-4159-928d-4bfe40dcea45` 进行中；不能在它结束前重启此服务。
- 初次双 Codex Session `34e82ac7-92bd-488f-8bd0-e4af6cc61b5e` 已 completed，独立 Node 测试 27/27；原始记录 `.ramune/runs/<id>.json`。
- 12 个 Vitest 测试通过；3 个 Playwright 浏览器测试通过；真实服务强制结束、重启、unknown、不自动重放、明确重试的集成测试通过。
- Ubuntu systemd 用户服务已运行；Claude Code 2.1.160 本地 auth status 显示 loggedIn，但真实调用 `de425b9f-6b34-4e5a-a566-a425d1baa58a` 返回 401 Invalid API Key。已异步提示用户，需要用户登录，不能声称 Linux Agent 闭环成功。
- Windows 真实运行曾遇到 Codex 可恢复的 reconnect error 事件；已修复协议解析，只有最终失败事件或退出码失败才判失败，并新增真实流式子进程回归测试。
- 页面截图 `.ramune/screenshots/studio-4317.png` 已检查，浏览器无页面错误。

## 待完成

等待最终真实运行，最终构建及两套服务部署到同一版、Linux 确定性/浏览器检查、最终截图与交付记录、Git commit/push 和远程核验。Linux Agent 认证单独保留阻塞；不要自动复制凭据或绕过原生权限。
