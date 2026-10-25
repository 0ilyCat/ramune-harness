Status: ready-for-agent

# 自主交付规格

2026-10-25 用户授权从现有需求直接实现并推送到 origin。采用 TypeScript、React、React Flow、Hono、Zod、Execa，复用本机已安装的 Agent CLI，不重造模型与工具循环。

## 验收范围

- 当前环境 Agent 发现、真实版本与登录诊断，不用演示响应冒充 Agent。
- 可拖拽、连接、配置、保存及导入导出的图编辑器；左右脑模板。
- 顺序节点执行，按 success/failure 路由，有界调用与超时，取消和工作目录互斥。
- 真实 Prompt、CLI Session、工具事件、输出及独立检查结果；SSE 重连。
- 原子 Checkpoint、调用身份、重启中断识别；结果未知时人工检查后明确选择恢复或重试。
- 无模型节点可独立运行。Agent 以已有 CLI 的权限机制执行，Ramune 的工作目录不是安全沙箱。
- Windows 原生和 WSL Ubuntu 分别部署，端口 4317 / 4318，持久数据分离。
- 真实 Agent 编程及验收、自动工程测试、浏览器端到端验证、中文交付记录。

## 边界

首版提供 Codex、Claude Code adapters；其他 CLI 显示发现情况但没有验证的协议不标记为可运行。不包含公网多租户、任意插件热加载、并发图与桌面安装包。两张卡可以调用同一个已登录 Harness 的不同独立 Session。
