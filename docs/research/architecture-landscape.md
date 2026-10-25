# Ramune Harness：架构调研与技术全景

完成日期：2026-10-09（Asia/Shanghai）。一手资料快照采集于 2026-10-08，研究跨越两天。范围 A–F 均已覆盖。研究使用 Matt Pocock `research` 技能：后台代理阅读官方源码/原始文档，并保留来源底稿；主报告整合架构判断。没有实现产品、创建脚手架、安装依赖、调用真实 LLM 或做性能测试。

> 极小循环。其他一切皆节点。智能是可选的。

用户已于 2026-10-09 确认采用混合复用路线，决策见 [ADR-0001](../adr/0001-hybrid-reuse.md)。下文保留调研分析；具体依赖与待访谈的执行需求不因路线确认而自动确定。

**结论：优先混合复用。** 保留一个与 Provider/React Flow/平台框架无关的有界工作流 Kernel，采用 React Flow 编辑器、Vercel AI SDK Core、成熟 Schema/UI/进程/验证组件。Build 仅限用户可编辑图的领域语义、节点契约、映射、组合和追踪。若首版要求持久审批中断、并发合流与崩溃后自动恢复，优先把调度切换为 LangGraphJS，而不是继续扩写“几十行”的恢复引擎。三条路线和改变推荐的条件详见 [推荐技术组合](recommended-stack.md)。

## 研究方式与证据边界

源码在项目外临时目录浅克隆，用 `git ls-tree`/`git show` 验证路径与实现；重要链接固定到 SHA。维护证据采用实际提交/发行时间与官方停止维护公告，不用 Stars。GitHub 匿名 REST API 达到限额时改用 git、官方发布页和 npm registry，未把查询失败解释为项目无活动。

HEAD、源码 package version 和已发布 stable 不是同一指标。AI SDK 与验证工具的 stable 元数据另行核查；其他源码快照不自动成为安装清单。此报告判断的是接口、可复用性与架构成本，没有吞吐/价格/可靠性实测。实际依赖兼容、锁版本、端到端运行与跨 OS 行为在需求规格确定后验证。

| 材料 | 用途 |
| --- | --- |
| [复用矩阵](reuse-matrix.md) | 每个候选的官方仓库、License、维护证据、源码入口、优缺点与 Adopt/Extend/Compose/Build |
| [运行时证据](runtime-evidence.md) | mini/Pi/DeepSeek/LangGraph 的固定源码与恢复语义 |
| [可视化工作流证据](visual-evidence.md) | React Flow/Flowise/Langflow/Dify/n8n/Graphon 的编辑器、JSON、节点注册与许可 |
| [SDK 与验证证据](sdk-verification-evidence.md) | Provider 对比、真实版本/engines/peers、成熟 Check 接入 |
| [安全与模块设计证据](security-modularity-evidence.md) | Shell、隔离、凭据、Schema/注册与组合的事实和设计推论 |

以下“事实”来自所引一手资料；“建议”是本项目设计推论，尚未成为最终需求。

## A. 智能体运行时：两种循环不能混同

内层 Agent loop 通常是 Model→工具→观察→Model，主要 state 是消息与会话。外层 workflow loop 则运行任何节点，维护 invocation、状态传递、端口路由与循环限制。用户要求 Intelligence optional，意味着后者不能由“必须有 Model 的会话框架”定义。

| 候选 | 循环与工具调用 | 上下文与状态 | 控制与恢复 | 对 Ramune 的意义 |
| --- | --- | --- | --- | --- |
| mini-swe-agent | `run→step→query→execute_actions`；v2 默认原生 tool calling，动作由模型 adapter 归一化 | 线性 messages + 观察/费用/步数；工具核心仍 bash-oriented | step/cost/time/格式错误限制；保存轨迹，不等同通用图 checkpoint；Windows 进程树限制 | 最清楚的最小协调循环参照，Python 包可外部 Compose；不移植复制一套 TS mini |
| Pi | TS Agent core，模型工具循环、流事件、before/after hook、可控顺序/parallel batch | transformContext 与 convertToLlm 分开；agent-core 内存状态；coding-agent 另有 session tree/compaction | abort/continue/steer 与工具事件；coding 会话 resume 不等于 shell exactly-once | 可选 CodingAgent 组合卡片；内部 loop 明示、子 trace 可见，避免与普通 AI SDK 节点双栈 |
| DeepSeek Harness | Cordis 插件/服务 + 可换 Agent driver；exclusive/parallel-safe 工具调度 | append-only session events 与模型 surface 投影分离；request header 可重建调用边界 | 明确 `TOOL_NOT_STARTED` / `TOOL_OUTCOME_UNKNOWN`；只有挂载 persistence 才持久；preview breaking changes | 借鉴插件生命周期和恢复的不确定性；不把服务依赖图直接当端口工作流图 |
| LangGraphJS | 不要求模型；StateGraph、conditional edges、Command/Send、循环/子图 | State/channel/reducer/Pregel superstep；messages 是可选字段 | checkpointer、interrupt、retry；MemorySaver 不跨重启；interrupt 从节点开头重跑 | 路线 C 最强匹配；用户 JSON 仍需编译和 port→state adapter |

来源：[mini default](https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/src/minisweagent/agents/default.py)、[mini v2 migration](https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/docs/advanced/v2_migration.md)、[Pi loop](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/agent/src/agent-loop.ts)、[Pi sessions](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/coding-agent/src/core/session-manager.ts)、[DeepSeek session](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/packages/core/session/README.md)、[LangGraph StateGraph](https://github.com/langchain-ai/langgraphjs/blob/1631fd895723c4553345ceb5d9fc425b68bda959/libs/langgraph-core/src/graph/state.ts)、[interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)。

**版本修正**：Pi 官方仓库已由旧 badlogic/pi-mono 重定向到 `earendil-works/pi`，包 scope 也变更；DeepSeek 的准确官方项目由 [DeepSeek 产品页](https://www.deepseek.com/harness/en/) 确认，不使用同名第三方 Harness；LangGraphJS 当前 `libs/langgraph-core` 目录与旧教程不同。

**建议的复用边界**：普通 Model 卡片做单次调用，Tool 卡片做实际执行；可选 Pi/外部 Harness 卡片允许封装已存在的内层 loop，但 UI 与预算必须展示其子执行。只有一个 owner 控制每一层循环、工具授权和重试。不要同时引入多个 Agent 框架并让它们控制同一个 workflow。

**恢复事实不能夸大**：存 trace、保存模型上下文、持久 graph checkpoint、恢复进程资源、保证外部副作用不重复是五件事。DeepSeek 的 unknown 状态和 LangGraph 的节点重跑说明，即使复用成熟引擎，也必须处理“副作用发生后，结果落盘前崩溃”。[DeepSeek repair](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/packages/core/session/src/repair.ts)

## B. 可视化工作流：可复用画布与平台的区别

| 项目 | 节点/端口与 JSON | 注册/运行 | 编辑器/runtime 复用判断 |
| --- | --- | --- | --- |
| React Flow | handle ID + source/target handle；保存 nodes/edges/viewport；parentId 表示视觉层级 | `nodeTypes` 是 React renderer map；没有 workflow scheduler 或 JSON Schema 验证 | 直接 Adopt 通用库与免费 UI；Build domain adapter。完整 AI Workflow Editor 为 Pro 模板，未获取付费源码 |
| Flowise | INode 参数 metadata + FlowData nodes/edges/viewport | NodesPool 扫描 `require(file)` 后实例化 `nodeModule.nodeClass`；buildAgentflow 有 queue、loop 计数/输入等待 | 确有 `packages/agentflow` 嵌入组件，但 dev.14、必需 Flowise API、React18/Flow11；官方 EOL，排除长期底座 |
| Langflow | Python Component inputs/outputs/method 与 frontend APIClass/handle metadata | LFX Graph 支持 cycles/checkpoints；组件索引/目录加载；RunFlow 暴露内图参数 | MIT，但完整 UI store/API 耦合；Python 可接受时 Extend/Compose LFX，当前 TS 推荐只参考设计 |
| Dify | React Flow graph + ValueSelector 字段路径；平台 YAML DSL 带应用/plugin dependencies | UI NodeComponentMap 与工具/provider 插件不同；NodeFactory 接 Graphon/type/version | 产品交互参考；前端复制/多租户受自定义 License 条件；不复制 console |
| Graphon | 独立 Python Graph/NodeFactory 与状态池；host protocols | engine/dispatcher/scheduler/frames；type/version 注册；loop/iteration/snapshot/resume | 单独 Apache-2.0，可 Compose Python GraphRunner，不把它与 Dify console 许可混为一谈 |
| n8n | 主流 main 与 ai_tool/ai_memory 等能力端口；nodes + connections，item/input/output 槽位 | PackageDirectoryLoader 与 versioned node type；workflow-execute 队列/部分执行/等待 | UI 为 VueFlow；核心/编辑器与公开用途有许可成本；可选外部服务节点 |

来源：[React Flow Handle](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/packages/react/src/components/Handle/index.tsx)、[Sub Flows](https://reactflow.dev/learn/layouting/sub-flows)、[AI Pro 模板](https://reactflow.dev/ui/templates/ai-workflow-editor)、[Flowise 嵌入 API](https://github.com/FlowiseAI/Flowise/blob/9291856d1ea4a4ceea9f8fef8ce14f4f6c81e8eb/packages/agentflow/src/index.ts)、[sunset](https://flowiseai.com/sunset)、[LFX Graph](https://github.com/langflow-ai/langflow/blob/504c02fc47e76087b82b0e7cbe4186e9cdd916d4/src/lfx/src/lfx/graph/graph/base.py)、[Dify NodeFactory](https://github.com/langgenius/dify/blob/2b65f0e8930964ce2be9e7054dde5a2cd74ff605/api/core/workflow/node_factory.py)、[Graphon architecture](https://github.com/langgenius/graphon/blob/0384e3f4958a723ccb135175f6ca3fabfbc932a8/ARCHITECTURE.md)、[n8n interfaces](https://github.com/n8n-io/n8n/blob/03f7c76acdca8510ad65b49a78578e42819d708a/packages/workflow/src/interfaces.ts)。

**维护/许可影响真实选择**：Flowise 官方冻结/EOL，不能继续作为维护中的候选推荐；Dify 品牌/多租户条款与 n8n Sustainable Use/Enterprise 条款影响未来公开产品；Graphon 是独立 Apache-2.0 项目。详细已读文本见 [复用矩阵](reuse-matrix.md)，不是用 GitHub license badge 作结论。

**专业 UI 建议**：在 React Flow + 免费 UI/shadcn 基础上明确产品验收：可搜索卡片库、有效端口连接反馈、字段错误、属性 Inspector、运行与编辑分离、撤销/重做、保存版本提示、循环计数/子图 breadcrumb、逐次调用 Trace、错误定位、键盘等效操作与一致视觉 token。既不重造画布，也不把“框架能拖拽”当成专业交互完成。[React Flow UI](https://reactflow.dev/ui)、[Radix primitives](https://www.radix-ui.com/primitives/docs/overview/introduction)

## C. 模型供应商：复用协议与工具解析，保留调度权

AI SDK Core 的 generateText/streamText、官方 provider adapter、registry、Schema/tool calling、流/usage/abort/errors 已提供多数多 Provider 能力。推荐作为 Model 节点的主要能力库，而不采用其高层 workflow/agent/harness 循环。同一天 stable `ai 7.0.133` 与 adapters 有不同版本号，Node engines 均 >=22；源码/registry 与旧 AI SDK 5/6 示例有差异。实施时锁一个经过验证的组合。[provider registry source](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/ai/src/registry/provider-registry.ts)、[npm ai](https://registry.npmjs.org/ai/7.0.133)

**关键源码事实**：当前默认单步停止 `isStepCount(1)` 仍在判断停止前执行带 `execute` 的工具。为了使本地/application-owned Tool 卡片拥有权限、输入、输出、耗时与错误，Model 的此类工具定义只提供 schema；模型返回 toolCalls 后由 Kernel 激活已授权的 Tool node，再追加 tool results。Provider-side 托管工具在远端执行，必须作为独立远程能力授权/标注，只能展示供应商实际提供的事件，不能声称省略 execute 就能把它们变成本地卡片执行。不要自己写成熟 SDK 已有的 JSON/tool-call 流解析。[generateText](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/ai/src/generate-text/generate-text.ts#L1342)、[不带 execute 的官方测试](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/ai/src/generate-text/generate-text.test.ts#L4338)

OpenAI JS SDK 可直接提供 Responses、stream、Zod helpers、厂商独有特性。当前已有 Azure/Bedrock provider 支持，不能写成“OpenAI-only”；但这不等于任意 Anthropic/Gemini 原生协议都统一。若 AI SDK 未暴露所需 OpenAI 功能，可 Compose 专用 adapter，普通同一请求不叠两套 SDK。[OpenAI client](https://github.com/openai/openai-node/blob/bc6c0bfb70f253d5caa3f335699e9713ea9067b5/src/client.ts)、[provider source](https://github.com/openai/openai-node/blob/bc6c0bfb70f253d5caa3f335699e9713ea9067b5/src/internal/provider.ts)

**建议的 Provider 能力矩阵**：分别标 text、stream、tool calling、structured output、image/files、reasoning/caching、usage、abort 和 provider-side tools。OpenAI-compatible 仅表明一组兼容协议，不能一个布尔值代表所有能力。[AI SDK compatible providers](https://ai-sdk.dev/providers/openai-compatible-providers)

Model 输出保留 provider warnings、refusal/incomplete、stream partial/error 与 usage unavailable；对外部模型重试单独记录 attempt。SDK 请求 retry 和 Kernel 节点 retry 不叠成不可见多重循环。上下文整理/压缩是 Context/Memory 节点或可选能力，不要求所有 state 都自动变为模型 messages。

## D. 验证：检查节点执行成熟工具

| Check 能力 | 直接集成 | 报告与错误语义 |
| --- | --- | --- |
| Type Check | 目标项目的 TypeScript CLI `tsc --noEmit` | exit + raw diagnostics；不写自制 checker，不把 TS 编译类型当运行 JSON 验证 |
| Build | 目标项目已有 build script；本项目候选 Vite build | artifacts + exit；Vite transpile 不代替 Type Check，配置/plugins 仍可执行代码 |
| Test | Vitest `run` 或目标项目原生 test runner | JSON/JUnit artifact，区分失败/无测试/配置错误/损坏报告/取消/超时 |
| Browser Check | Playwright test + webServer + reporter/trace | JSON/HTML report/screenshots/trace refs；浏览器测试通过不单独证明视觉质量 |
| Lint（可选） | ESLint formatter/公开 Node API | check 与获准 fix 分开；TS parser/plugin 与当前 TS7 兼容需核验 |

来源：[TypeScript noEmit](https://www.typescriptlang.org/tsconfig/noEmit.html)、[Vite TS 特性](https://vite.dev/guide/features#typescript)、[Vitest reporters](https://vitest.dev/guide/reporters)、[Playwright reporters](https://playwright.dev/docs/test-reporters)、[webServer](https://playwright.dev/docs/test-webserver)、[ESLint formatters](https://eslint.org/docs/latest/use/formatters/)。

当前 TypeScript 主仓库已是 native Go compiler、`tsc/internal/...` 目录，不能复制旧 `src/compiler` 的路径/API 判断。7.0 不提供旧 programmatic API，官方建议需要旧 API 的工具采用兼容策略；这里优先公开 CLI，版本兼容在下一阶段验证。[官方 TS7 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)

**建议**：Check 返回稳定 outcome、exit code、diagnostics、duration 和原始 artifact references；Router 按结构化结果决定继续/退出。构建/测试脚本具有代码执行权限，因此 Check 与 Shell 共用能力宿主、cwd、env、timeout 和输出限制，不能因名称是验证就绕过授权。Agent 修改其他技术栈仓库时使用它自己的验证命令，不强制所有被操作仓库都用 Vite/Vitest。

## E. 安全：本地变更隔离与不可信执行隔离

**事实**：Node child_process 的 cwd 只是工作目录，子进程拥有宿主权限；Node Permission Model 不是恶意代码 sandbox。Execa 提供执行参数、timeout、cancelSignal、流和清理，但默认 extendEnv=true、killDescendants=false。Windows 子树终止使用 taskkill，父进程退出/枚举失败时存在 best-effort 限制。[Node child_process](https://nodejs.org/api/child_process.html)、[permissions](https://nodejs.org/api/permissions.html)、[Execa options](https://github.com/sindresorhus/execa/blob/63ddae6aeb6934da06fdb3754647791e58cd87c3/lib/arguments/options.js)、[kill-descendants](https://github.com/sindresorhus/execa/blob/63ddae6aeb6934da06fdb3754647791e58cd87c3/lib/terminate/kill-descendants.js)

| 关注点 | 当前本地 MVP 的建议 | 未来公开部署的新增需求 |
| --- | --- | --- |
| Shell 权限 | 受限 executable+args 与显式批准 arbitrary shell 分开；工作目录、图 revision、工具集合进入授权范围 | 不可信代码在隔离 executor，租户/run 分离；不能仅靠 regex 命令黑名单 |
| 文件 | realpath/目录与 symlink 检查约束受限 file tools；worktree 可隔离变更 | 最小挂载、隔离文件系统、ACL、大小/配额与 artifact 隔离 |
| 超时/取消 | 复用 Execa 与 SDK abort，清理/限量日志；明确 Windows best effort | 资源限制、executor 租约/回收、可审计的停止/超时与残留任务治理 |
| 密钥 | 后端 env/内存或后续 OS store；图只有 credential reference；Model key 不传入无关 shell；日志脱敏 | secret store、短期/分租户凭据、轮转和授权审计 |
| 控制接口 | loopback + Origin/Host/session 校验；CORS 不是认证；SSE 断开不自动取消 | 身份/租户授权、SSRF/egress 策略、配额和审计 |
| 插件 | 受信任、已打包的 TS 节点启动注册；工作流 JSON 不触发任意动态 import | 插件 provenance/制品/权限、隔离运行与依赖漏洞治理 |

这些是设计建议，依据 [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)、[Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) 和进程/容器的一手机制。Docker/Moby 可组合为受限 executor；`--network none` 会阻断联网调用，rootless/只读挂载/资源限制需要一并选择，不把挂 Docker socket 或宿主 home 视为隔离。公开敌对多租户可能需要更强隔离，届时单独评估而不自写 sandbox。[Docker security](https://docs.docker.com/engine/security/)、[rootless](https://docs.docker.com/engine/security/rootless/)、[bind mount](https://docs.docker.com/engine/storage/bind-mounts/)

**恢复与安全相交**：开始但没有结果的 Shell 不自动重跑；Check 被 disabled 不自动视作 passed；run 固定 graph hash/节点版本，编辑图不改变旧 run 已批准的能力。公开部署不是给本地 Hono 服务简单加一个监听地址。

## F. 模块设计：明确节点契约与路由，保留小接口

下面是从各项目推导的候选模型，尚未最终批准或写成产品代码。

### 四种定义应分别保存

| 对象 | 核心信息 | 不该承担什么 |
| --- | --- | --- |
| NodeDefinition | namespaced type/version、config/input/output schemas、ports、executor factory、UI metadata、capability requirements | 不代表某张卡的位置或某次运行；UI renderer 不是 executor |
| NodeInstance | id/type/version/config/enabled、input bindings、组合 graph ref | 不保存 API key、函数、Provider 实例、AbortSignal 或活进程 |
| WorkflowDocument | schemaVersion、入口/出口、nodes、typed/control edges、bindings、budgets、subgraphs、独立布局 metadata | 不依赖 React Flow 的 selected/dragging；不绑定某框架 checkpoint 对象 |
| Invocation / RunRecord | run/graph revision、node/attempt/iteration/parent、输入输出、outcome、时间、logs/artifacts、错误 | 不用 node ID 覆盖全部历史；不把未报告 usage 写成零消耗 |

Zod 提供 runtime validation/TS inference/可表示 JSON Schema 导出；其 metadata registry 不是 executable plugin registry。如果用户可编辑任意 JSON Schema，采用 Ajv 的正确 draft，而非自写 validator 或把实验性反向转换当无损协议。[Zod registries](https://zod.dev/metadata)、[JSON Schema 转换限制](https://zod.dev/json-schema)、[Ajv security](https://ajv.js.org/security.html)

### 控制与数据不是一条含糊的线

候选 MVP 先采用顺序 control-flow：entry 激活节点，binding 计算它的输入，校验后执行，返回 output/state update/outcome，Kernel 按 outcome port 路由。数据引用带 activation/iteration 语义，回边不能误取上一轮 stale output。主流程控制边、字段映射和 Model 的 Tool/Memory 能力绑定分别表达；后者可参考 n8n main/ai_* 的区分，但不复制其 item pairing 数据契约。

Router/Decision 可是确定性规则；Model 也可选择结构化 outcome。Model 不能任意 invent 一个工具名就执行本地代码，名称要解析为 run manifest 中已注册且获授权的 Tool 节点。Memory 可以存会话、文件引用或检索结果，Context 节点决定这轮给模型看什么；它们不是 Kernel 内置数据库。

Schema 连线兼容先处理明确 port kind 与有限结构规则，最终校验实值。完全 JSON Schema assignability 很复杂，不应在 MVP 实现一个未经证明的兼容算法。输入 mapping 首批用 literal/state/upstream path；限制 expression/refs，避免 eval 与自动任意 URL `$ref` 拉取。

### 启用、替换、组合都有语义

- disabled 可为明确 identity bypass、显式 mapping 或不可运行；多端口 Router/Check 没有自然“跳过后接哪条边”的默认答案。缓存结果也不能和 disabled 等同。
- 替换节点校验 ports/schema/config version；旧 config 的迁移是独立操作，不静默删除失配连线。
- Composite 暴露内图 input/output 契约与绑定，锁 subgraph revision；复用同一 runner，继承预算/取消/能力，子 invocation 关联 parent。视觉矩形 group 只是 UI 层。
- 自定义循环与分支保留，但步数/时间/适用时 usage/cost 预算必须可控；递归组合另有深度规则。parallel/fan-in/merge strategy 在访谈后决定，不能悄悄从串行执行升级为任意 cyclic dataflow。

### 内核的职责边界

Kernel 协调节点执行、状态更新、edge routing、循环控制。编译/Schema、Provider、进程、业务 Check、密钥、React Flow renderer、事件呈现都是模块。`CapabilityHost`、`EventSink`、`CheckpointStore` 作为注入接口；它们的错误/写入顺序要明确，不能因为置于 hook 就默认是 durable。若选 LangGraph，把它放在 GraphRunner 的实现角色，而不是让图文件绑定其内部 state。

## 模板如何符合核心理念

| 模板 | 建议的节点关系 | 需要确认的边界 |
| --- | --- | --- |
| 简单聊天 | Input→Context/Memory（可选）→Model→Output | 是否流式、会话持久性、多模态 |
| Coding Agent | Context→Model→Tool→观察/Context→Model；Check/停止分支 | 文件/命令权限，模型与工具 loop owner，恢复 |
| Ralph Loop | 每轮重建 Context→Coding 子图→Check→Decision→继续/结束 |  fresh context 的精确定义、任务进度保留、完成判据/次数限制 |
| 自主软件开发 | 任务选择/规划→实现子图→Type/Build/Test/Browser Checks→修复或交付/人工关口 | 首个可验收交付、哪些动作自动、哪些持久副作用获授权 |

Ralph 原作者把它作为一轮一任务、上下文安排与验证 backpressure 的实践，而不是一个统一软件协议。四种 preset 应是可编辑的版本化 graph，Kernel 不需要知道模板名称。[Geoffrey Huntley 原文](https://ghuntley.com/ralph/)

## 仍需访谈与后续实测的内容

首版个人本地使用范围已确认。接下来确认操作系统、自动恢复/人工暂停/并发需求、第一验收场景、模型供应商及任意 Shell/插件权限。随后明确 disabled/替换/组合、循环/合流、数据映射、运行记录保存与 UI 质量标准。再写规格与 ADR；当前不将待确认假设升级成已批准的功能范围。

实施期验证必须覆盖：无模型图可运行；合法/非法输入输出；本地/application-owned 工具仅经 Tool node 执行，远端托管工具另作能力授权与 trace 标注；回边不读旧值；子图预算/取消传播；副作用发生后 checkpoint 前崩溃不自动重做；日志超量可停止；导出与 trace 不泄露凭据；键盘/拖拽/错误定位与 Inspector；各 Provider 的工具/结构化/stream/abort 能力。研究阶段没有运行这些测试。
