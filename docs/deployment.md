# 本地双环境部署

## 部署布局

| 项目 | Windows | WSL Ubuntu-24.04 |
| --- | --- | --- |
| 页面 | `http://127.0.0.1:4317` | `http://127.0.0.1:4318` |
| 应用 | 当前仓库 `dist/` | `~/.local/share/ramune-harness/app` |
| 数据 | 当前仓库 `.ramune/` | `~/.local/share/ramune-harness/data` |
| 日志 | `.ramune/windows-4317.*.log` | `~/.local/share/ramune-harness/logs/` |
| 管理 | 隐藏 Node 进程和记录的 PID | `systemd --user` 服务及独立 WSL 保活会话 |

Linux 依赖在 Linux 中通过 `npm ci` 安装并构建，不共享 Windows 的 `node_modules`。默认寻找已有 nvm Node 24；可用 `RAMUNE_NODE_BIN` 指定 Node 所在目录，用 `RAMUNE_INSTALL_DIR` 指定新的专用安装目录。脚本拒绝覆盖不属于本应用的已有安装目录，不修改系统 Node、WSL 网络、代理、凭据或其他项目。

## 启动和停止

Windows 在仓库运行：

```powershell
npm ci
npm run build
npm run deploy:windows
npm run deploy:wsl
```

停止时使用工作区内的管理脚本，不结束其他 Node 或 WSL 服务：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop-windows.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop-wsl.ps1
```

Windows 停止脚本验证 PID 的命令行属于本工作区。强制停止时，尚无持久结果的调用会在下次启动后变成 `interrupted/unknown`，需要检查工作目录及残留进程，再确认重试或跳过。优先先在页面取消活动运行，然后停止服务。

WSL 服务可直接管理：

```sh
systemctl --user status ramune-harness.service
systemctl --user stop ramune-harness.service
systemctl --user start ramune-harness.service
```

WSL 服务已设为用户服务启用状态；Windows 的隐藏 WSL 保活会话用于防止最后一个 WSL 调用退出后实例被终止。Windows 重启后重新运行部署命令以启动本地应用。没有安装系统级服务、修改全局防火墙或开放公网端口。

## 更新

先取消活动运行，再执行对应停止脚本。更新代码后 `npm ci && npm run build`，再运行部署脚本。WSL 脚本复制源码、在 Linux 安装锁定依赖并构建。原有私有数据目录保留；端口被占用时拒绝停止未知服务。同一数据目录使用独占进程锁，避免两个服务同时改写 Checkpoint。

## Agent 与凭据

Windows 与 Ubuntu 分别从服务 PATH 发现 CLI，并通过原生登录命令检查本地认证状态。本地凭据存在不代表服务端接受；最近一次实际调用若返回 401，会显示“认证失败”并保留真实错误。

Windows Codex 复用原生配置。Ubuntu Claude Code 复用用户已有 Windows CLI Proxy，不需要登录 Claude 账号；专用设置位于 `~/.local/share/ramune-harness/data/claude-settings.json`，权限为 `0600`，通过 `RAMUNE_CLAUDE_SETTINGS_FILE` 注入，既不修改全局 Claude 配置，也不把 Key 写进仓库或工作流。节点 model 优先于专用配置，专用配置优先于原生默认值。

当前 WSL 使用 NAT，原代理只监听 `127.0.0.1:8317`。应用只增加 TCP 转发：WSL → Windows 虚拟网卡 `18317` → 原 `127.0.0.1:8317`，仅允许当前 WSL 地址连接，没有再启动一份 CLI Proxy。`deploy:wsl` 会重新识别虚拟网卡地址并刷新本应用配置；`scripts/stop-proxy-bridge.ps1` 可单独停止转发，保留原代理。配置 Claude 时使用主机和端口作为 `ANTHROPIC_BASE_URL`，由原生 CLI 请求 `/v1/messages`；OpenAI-compatible `/v1` 地址不能直接按相同路径拼接。参见 [CLIProxyAPI 官方 Claude Code 配置](https://help.router-for.me/agent-client/claude-code)与 [Microsoft WSL 网络说明](https://learn.microsoft.com/en-us/windows/wsl/networking)。

Agent 使用原生权限。Codex 采用 `workspace-write / never`，某些 Windows 环境会拒绝 Agent 自己创建测试子进程；可以在记录中看到真实 `spawn EPERM`。模板的独立 Check 节点由用户在启动前授权后执行配置命令，结果单独记录，不能把 Agent 的自述当作测试通过。

## 开发与检查

生产服务独立于开发服务。分别启动：

```sh
npm run dev:server
npm run dev
```

浏览器打开 `http://127.0.0.1:5173`；Vite 代理至开发后端 `4319`，数据使用 `.ramune/development/`。只有开发后端允许这两个明确的 loopback 开发 Origin；生产服务不会放宽 Origin。不要把本地任意执行能力暴露到公网。

```sh
npm test
npm run build
npm run test:e2e
node scripts/restart-smoke.mjs
npm run test:live
```

浏览器测试默认在 `4320` 启动独立测试服务；用 `RAMUNE_E2E_URL` 指定已运行的另一套服务可以验证 Linux 的真实 API 与前端。测试会创建独立验收工作目录，不会修改现有用户项目。`test:live` 消耗真实 Agent 配额；认证失败按失败记录。
