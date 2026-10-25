# 智能体运行时：一手证据与复用判断

调研日期：2026-10-08（Asia/Shanghai）。这是 A 部分的来源底稿；结论属于面向 Ramune 的设计判断，不是上游的性能承诺。只阅读源码、官方文档、许可证和官方发布页；没有安装依赖或执行上游 Agent。源码以临时目录浅克隆取得，引用固定提交。GitHub REST API 当时受匿名额度限制，维护证据改用 git 提交和发布页 HTML 的 `datetime` 属性。HEAD 是调研时观察到的默认分支版本，不能替代稳定发行版兼容性验证。

## 快速结论

需要区分两种循环：外层工作流循环执行任意节点、传递数据和选边；内层 Agent 循环执行模型请求和工具调用。Model 不应成为外层 Kernel 的必需依赖。Pi 和 mini 的内层循环不能直接等同于任意卡片图运行时；LangGraph 能执行不含模型的图，但有自己的 State/reducer/Pregel 语义；DeepSeek 的插件生命周期也不同于连线端口和图调度。[Pi loop](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/agent/src/agent-loop.ts)、[mini loop](https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/src/minisweagent/agents/default.py)、[StateGraph](https://github.com/langchain-ai/langgraphjs/blob/1631fd895723c4553345ceb5d9fc425b68bda959/libs/langgraph-core/src/graph/state.ts)、[DeepSeek core map](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/packages/core/README.md)。

**建议：混合复用。** 在本地、串行、显式有界循环的 MVP 中，只 Build 产品独有的图解释器与节点契约；Compose 成熟 Provider SDK、工具执行库和 UI。Pi 可成为可选 CodingAgent 组合节点。若访谈确认 MVP 必须支持持久化人工中断、并行分支和嵌套恢复，则重新优先评估 LangGraphJS，以避免重造其恢复引擎。不要同时把 Pi、LangGraph 和 DeepSeek 全部塞进主运行路径。

## 维护与许可快照

| 候选 | 官方 GitHub | 实际根许可证 | 观察到的提交 | 官方发布证据与判断 |
| --- | --- | --- | --- | --- |
| mini-swe-agent | [SWE-agent/mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) | [MIT，2025 Lieret/Jimenez](https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/LICENSE.md) | [04d809c](https://github.com/SWE-agent/mini-swe-agent/commit/04d809ceab9df28f9adaed044884180159172930)，2026-09-03 | [v2.4.6](https://github.com/SWE-agent/mini-swe-agent/releases/tag/v2.4.6)，2026-07-23T03:12:33Z；持续有维护，节奏低于另外三个项目，不能从此推断弃用 |
| Pi | [earendil-works/pi](https://github.com/earendil-works/pi)；旧 [badlogic/pi-mono](https://github.com/badlogic/pi-mono) 现重定向 | [MIT，2025 Mario Zechner](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/LICENSE) | [6fb2e78](https://github.com/earendil-works/pi/commit/6fb2e7815167e6b19006fc526d1a5d0f5f998787)，2026-10-08 | [v1.1.0](https://github.com/earendil-works/pi/releases/tag/v1.1.0)，2026-10-07T22:26:31Z（北京时间 10-08）；近一周多个版本，活跃且近期有包名/API 迁移 |
| DeepSeek Harness | [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) | [MIT，2026 DeepSeek](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/LICENSE) | [5badb15](https://github.com/deepseek-ai/deepseek-harness/commit/5badb15009ae1756c3afe0ae0cef1faafc290ccc)，2026-10-03 | [dsh-v0.2.1-alpha.1](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-alpha.1)，2026-10-03T06:42:19Z；9 月连续发布，仍为 developer preview，明确承认破坏性变更 |
| LangGraph / JS | Python 官方 [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph)，本项目实际评估 [langgraphjs](https://github.com/langchain-ai/langgraphjs) | [MIT，2024 LangChain](https://github.com/langchain-ai/langgraphjs/blob/1631fd895723c4553345ceb5d9fc425b68bda959/LICENSE) | JS [1631fd8](https://github.com/langchain-ai/langgraphjs/commit/1631fd895723c4553345ceb5d9fc425b68bda959)，2026-10-08 | [@langchain/langgraph@1.4.21](https://github.com/langchain-ai/langgraphjs/releases/tag/%40langchain%2Flanggraph%401.4.21)，2026-10-07T16:26:07Z（北京时间 10-08）；持续发布和图运行时修复，活跃 |

四份已检查的根许可证都是标准 MIT：允许使用、修改和分发，复制代码或分发软件时必须保留版权和许可声明，附有无担保条款；这里未声称所有传递依赖都自动为 MIT。托管平台或账户产品的服务条款与开源库许可另行判断。

## mini-swe-agent：最小循环的设计标尺

### 实际源码入口

- `src/minisweagent/agents/default.py`：`DefaultAgent.run → step → query → execute_actions`；`run` 初始化消息并反复单步执行，退出条件为追加的 exit 消息。
- `src/minisweagent/models/`：模型适配器；`utils/actions_toolcall.py` 是 bash 的 JSON Schema 与 native tool-call 解析，`utils/actions_text.py` 保留旧文本动作解析。
- `src/minisweagent/environments/local.py`：本地命令执行、cwd/env/timeout、提交 sentinel 检查；`environments/docker.py` 等可交换运行环境。
- `src/minisweagent/run/hello_world.py`、`run/mini.py`：程序和交互 CLI 入口；`agents/interactive.py` 提供人工确认行为。

这些路径均来自固定提交的 [src 树](https://github.com/SWE-agent/mini-swe-agent/tree/04d809ceab9df28f9adaed044884180159172930/src/minisweagent)，不是依据旧版教程猜测。

### 循环、上下文、状态与恢复

循环本身只协调 Model 与 Environment。当前 v2 模型负责把响应解析为 `extra.actions`，Agent 顺序执行环境操作、追加观察结果。消息列表是线性历史，计费、调用次数、连续格式错误及耗时由 Agent 跟踪。它检查 step/cost/wall-time 限额，在每一步的 finally 保存序列化轨迹。格式错误转为可继续的反馈，但超出连续错误次数会结束。[default.py](https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/src/minisweagent/agents/default.py)。

**版本陷阱：v2 原生 Tool Calling 已是默认推荐。** 不能继续写成“完全不用 tool-calling”。保留的是 bash-only 的工具设计和可选文本解析模式；责任下沉至 Model adapter，减少协调器复杂度。[v2 migration](https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/docs/advanced/v2_migration.md)、[native parser](https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/src/minisweagent/models/utils/actions_toolcall.py)。

`serialize/save` 提供可观察轨迹，不能据此承诺进程崩溃后准确恢复任意外部动作：检查的 `run` 会重新初始化 messages，未见工作流 checkpoint 或副作用提交协议。本地实现是每次启动独立 subprocess，因此 shell 的 cd/export 状态不自动跨步骤保留。当前代码实际使用 Popen/communicate，README 仍以 subprocess.run 描述设计；POSIX 超时杀进程组，Windows 分支只调用 `process.kill()`，不应把它当作 Windows 进程树超时保证。[local.py](https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/src/minisweagent/environments/local.py)。

### 取舍与复用结论

优点：协调职责清晰、简单事件历史易检查、环境接口隔离；缺点：Python、bash coding-task 导向，消息形状可依模型变化，既没有端口式图运行时，也不是一般长期恢复引擎。**Compose（设计原则和可选 benchmark/reference Agent），不 Adopt 为 TS Kernel。** 可直接使用其 Python 包作为独立外部 Agent 节点；若移植源码需遵守 MIT，但本项目不应为了宣称复用而再维护一份 TypeScript mini 副本。

## Pi：可嵌入的智能体能力与工作流图内核的区别

### 当前名称与源码入口

当前主分支和 v1.1.0 采用 `@earendil-works/pi-agent-core` 与 `@earendil-works/pi-ai`；旧 `@mariozechner/*` 示例不能原样作为新项目依赖说明。[agent package.json](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/agent/package.json)、[ai package.json](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/ai/package.json)。

- `packages/agent/src/agent-loop.ts`：底层 loop、tool batches、流事件和上下文转换。
- `packages/agent/src/agent.ts`：`Agent` 类、状态、订阅、steer/followUp、abort/continue。
- `packages/agent/src/types.ts`：工具参数 Schema、结果、事件、生命周期 hook 契约。
- `packages/ai/src/`：Provider 统一接口与调用；`packages/ai/README.md` 说明模型目录、认证和跨 Provider 上下文。
- `packages/coding-agent/src/core/session-manager.ts`：JSONL append-only 会话树，id/parentId、branch/fork、路径上下文构造。
- `packages/coding-agent/src/core/compaction/`、`core/extensions/`、`core/tools/`；`packages/coding-agent/docs/sdk.md` 是嵌入 SDK 的入口。

[agent source tree](https://github.com/earendil-works/pi/tree/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/agent/src)、[coding-agent SDK](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/coding-agent/docs/sdk.md)。

### 循环、工具调用、上下文与恢复

`AgentMessage[] → transformContext → convertToLlm → Provider` 分离应用消息和模型消息。工具参数经 Schema 校验；beforeToolCall 可阻止执行，afterToolCall 可更改结果；支持顺序或并行 tool batch，逐工具 executionMode 可要求整个批次顺序执行。流事件给出 agent/turn/message/tool 生命周期、部分输出和耗时，适合映射到运行 Inspector。[agent README](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/agent/README.md)、[types](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/agent/src/types.ts)。

低层循环在 model response 含工具调用时继续，外层处理后续 queued input；finishTurn 可显式 continue/end，error/aborted 会终止当前运行。模型 stopReason=length 时不会冒险执行可能截断的工具参数。循环期间追加系统消息记录工具集变更；它把“运行可执行工具集合”与“模型看到的声明”对齐。Agent 类等待订阅处理，低层流接口只是观察性的，不能假设异步 consumer 是工具 preflight 屏障。[loop source](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/agent/src/agent-loop.ts)。

Agent core 的状态主要在内存；会话持久化、树分支、压缩和 resume 来自 coding-agent 层，不能把整个 coding-agent 的持久化能力归给轻量 agent-core。JSONL 会话树支持恢复上下文，不代表外部 shell 副作用可回滚或 exactly-once。[session-manager](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/coding-agent/src/core/session-manager.ts)、[sessions](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/coding-agent/docs/sessions.md)。

### 取舍与复用结论

优点：TypeScript、可以分层采用 agent-core/AI/coding-agent、工具和流事件成熟、应用消息保留扩展点。缺点：聊天/模型主导内层循环，不能直接表达任意 Port 图；Pi 自己的消息、TypeBox Schema 与 Provider SDK 若同时加入第二套会增加适配负担；最近包名/API 迁移需要锁版本和验证。

**Compose：优先作为 CodingAgent 组合节点。** 要做“自定义 Ralph 图”时，不必让 Pi 自己再控制同一层无限重试。采用 Pi agent-core 时连同其 pi-ai 边界使用，或明确测试自定义 streamFn 适配；不要为了接入 AI SDK 写一个未经验证的通用消息转换层。若主产品选择 AI SDK，则普通 Model/Tool 节点沿 AI SDK，Pi 可选节点承认拥有自己的内部会话。

## DeepSeek Harness：插件生命周期和恢复语义值得借鉴

### 身份、入口与源码

准确项目由 [DeepSeek 官方产品页](https://www.deepseek.com/harness/en/) 链接确认，是 `deepseek-ai/deepseek-harness`，npm 包 `@deepseek-ai/dsh`。它使用 [Cordis](https://github.com/cordiverse/cordis) 的插件框架；“核心只管理插件 mount/unmount/dependency”和 Ramune “核心管理图执行”相近但不同。此处没有把同名第三方项目当官方。

- `packages/core/agent/src/index.ts`：公共 Agent contract；`packages/core/agent-loop/src/index.ts`：默认 driver 插件入口与 AgentFactory 注册。
- `packages/core/agent-loop/src/agent.ts`：具体 ReactLoopAgent，inbox/turn/step/cancel/request。
- `packages/core/agent-loop/src/tool-calls.ts`：exclusive barrier 与有界 parallel pool。
- `packages/core/session/src/types.ts`、`surface.ts`、`request-header.ts`、`repair.ts`：事件协议、模型上下文投影、请求重建及损坏尾部语义恢复。
- `packages/core/tools/`、`system-prompt/`、`scope/`：工具注册与保护管线、prompt 拼装和按 Agent scope 的贡献生命周期。
- `packages/session/session-persistence-jsonl/`：持久化实现；`packages/bundle/base/` 与 `packages/bundle/sdk-minimal/`：完整与最小可运行组合。

[core group](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/packages/core/README.md)、[loop source tree](https://github.com/deepseek-ai/deepseek-harness/tree/5badb15009ae1756c3afe0ae0cef1faafc290ccc/packages/core/agent-loop/src)、[minimal SDK bundle](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/packages/bundle/sdk-minimal/README.md)。

### 状态、控制与恢复

服务/事件把能力组合到 Agent scope，默认 loop 仍是模型→工具→模型，Model/Tool/Storage 都可替换。会话事件日志和模型可见 history 分开：append-only 事实保留，surface 投影可替换当前上下文；请求 header 记录工具 Schema 与调用配置，resume 能重建请求边界。只有挂载 persistence backend 才有持久性；空 backend 是内存会话。[session contract](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/packages/core/session/README.md)、[agent driver](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/packages/core/agent-loop/src/agent.ts)。

exclusive 工具作为排序屏障，parallel-safe 工具受 maxParallelToolCalls 限制；开始后的工具会 drain，结果保持模型请求顺序，取消的未开始工具有合成结果补齐 transcript。工具 concurrency 不能按“所有工具都是 async 所以并行”处理。[tool scheduler](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/packages/core/agent-loop/src/tool-calls.ts)。

最值得复用的恢复区分：`TOOL_NOT_STARTED` 表示请求存在但没有持久化 start；`TOOL_OUTCOME_UNKNOWN` 表示已记录 start 但没有 durable result。后者不自动重试可能有副作用的动作。`openTurnClosers` 只补齐未关闭的尾部，不修复所有历史；fork 继承前缀也不意味着父分支的外部操作没有继续发生。硬崩溃在 stream settlement 之前也无法承诺保留每个 streamed chunk。[repair.ts](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/packages/core/session/src/repair.ts)、[session README](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/packages/core/session/README.md)。

### 取舍与复用结论

优点：TS 插件思想与目标吻合、注册可撤销且 scoped、具体 driver 可换、恢复面对副作用的不确定性。缺点：服务依赖图不是用户 workflow 图；默认 loop 强依 Agent/session/model 词汇；完整系统远超 tiny loop；developer preview 的 breaking changes 在 README 与近期 release 中都明确存在。[README](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/README.md)、[0.2.1 alpha release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-alpha.1)。

**Compose（设计与可选外部 Harness 节点）；暂不 Adopt/Extend 为主 Kernel。** 可直接调用其 SDK-minimal/RPC 组合而保留 package 版本边界；若要采用 Cordis 应单独做 license/API/dependency 审计和范围验证，此报告没有批准把 Cordis 全面引入。借鉴的核心是“注册拥有 disposer、事件可投影、未知结果不是失败结果”，而不是复制整套会话格式。

## LangGraphJS：框架扩展方案中最匹配图执行的一项

### 实际入口

- `libs/langgraph-core/src/graph/state.ts`：StateGraph、类型化 State/节点、reducer、compile。
- `libs/langgraph-core/src/graph/graph.ts`：边和 conditional edges。
- `libs/langgraph-core/src/pregel/index.ts`、`loop.ts`、`runner.ts`：superstep、调度、checkpoint、运行/重试。
- `libs/langgraph-core/src/prebuilt/tool_node.ts`：将 AIMessage.tool_calls 派发为 ToolMessage，默认并行多工具。
- `libs/langgraph-core/src/interrupt.ts`、`constants.ts`：interrupt/Command/Send 路由。
- `libs/checkpoint/src/`、`libs/checkpoint-sqlite/src/index.ts`、`libs/checkpoint-postgres/src/`：checkpointer 与持久化后端。

[StateGraph source](https://github.com/langchain-ai/langgraphjs/blob/1631fd895723c4553345ceb5d9fc425b68bda959/libs/langgraph-core/src/graph/state.ts)、[Pregel](https://github.com/langchain-ai/langgraphjs/tree/1631fd895723c4553345ceb5d9fc425b68bda959/libs/langgraph-core/src/pregel)、[ToolNode](https://github.com/langchain-ai/langgraphjs/blob/1631fd895723c4553345ceb5d9fc425b68bda959/libs/langgraph-core/src/prebuilt/tool_node.ts)。

### 状态、循环、上下文与恢复

图节点是更新共享 state 的函数，不要求 LLM；普通边、conditional edge 和 Command 可形成循环和分支，模型消息只是可选 state。并行节点在 superstep 产生写入，再通过 channels/reducers 合并；recursionLimit 约束图步数，不能把它等同单个模型预算或每条循环边次数。compile({checkpointer}) 启用 checkpoint，重试策略可按节点配置。[graph API](https://docs.langchain.com/oss/javascript/langgraph/graph-api)、[StateGraph](https://github.com/langchain-ai/langgraphjs/blob/1631fd895723c4553345ceb5d9fc425b68bda959/libs/langgraph-core/src/graph/state.ts)、[Pregel index](https://github.com/langchain-ai/langgraphjs/blob/1631fd895723c4553345ceb5d9fc425b68bda959/libs/langgraph-core/src/pregel/index.ts)。

短期 thread state 的 checkpointer 与跨 thread 的 Store 是不同层次；MemorySaver/MemoryStore 不是磁盘持久化。SQLite 适合本地，Postgres 可用于未来服务；SQLite 包当前采用 better-sqlite3，需要关注 Windows native addon 的运行环境兼容性。[官方 persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)、[sqlite manifest](https://github.com/langchain-ai/langgraphjs/blob/1631fd895723c4553345ceb5d9fc425b68bda959/libs/checkpoint-sqlite/package.json)。

**恢复不是恢复 JavaScript 栈，也不是副作用 exactly-once。** interrupt 恢复要求相同 thread_id 和 Command({resume})，被中断节点从头重跑，interrupt 之前的代码再次执行。节点内副作用需要幂等键、状态核对或独立 task/节点边界；不要把“恢复精确 graph state”宣传成“任何 shell command 不会重复”。[官方 interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)。

### 取舍与复用结论

优点：任意类型化图、循环/条件/子图/中断/持久化已有实现，是最能直接避免重造复杂恢复系统的方案。缺点：它的 state/reducer 和 superstep 不是 React Flow 字段端口数据流；需要编译自己的 workflow JSON，解决输入映射、disabled、组合节点和 graph version 绑定；library 的“独立使用”不等于零 LangChain 依赖，当前 @langchain/langgraph manifest 有 @langchain/core peer、checkpoint/sdk 等依赖。[package.json](https://github.com/langchain-ai/langgraphjs/blob/1631fd895723c4553345ceb5d9fc425b68bda959/libs/langgraph-core/package.json)。

**Extend：三方案中的现成框架基线；Compose：可选高级 GraphRunner。** 复用 StateGraph、conditional routing、checkpoint saver、interrupt、事件流，而不是重写它们。按 Ramune 中性 NodeDefinition 包一层，并让 React Flow 模型与 backend state 保持分离。是否在 MVP 主路径采用，取决于需求访谈确认的恢复/并发复杂度，不能仅凭“图”字或 Stars 决定。

## 对后续设计的约束（调研建议，尚未实施）

1. Kernel 接口接受 WorkflowDefinition、NodeRegistry 和 ExecutionContext；LLM Provider 作为节点依赖。
2. 模型 Tool Calling 的自动微循环只有一个 owner。若 Agent 作为组合卡片运行，其内部 turn trace 应以子 span 展示；若工作流显式连接 Model→Tool→Check→Router，则模型节点仅执行一次 SDK 请求。
3. 输入/输出 Schema 必须 runtime 验证；TypeScript 编译类型不能阻挡导入 JSON 或第三方插件的非法值。调用的工具参数与工具输出都应检查。
4. 所有循环需要步数、wall-clock/cost（适用时）预算和 AbortSignal；不能把图上的任意回边当无限许可。
5. 恢复日志区分 planned、started、completed、failed、unknown；started 无 result 的 shell 不能自动重跑。首个 MVP 可明确只支持节点边界恢复，并暂停 unknown 节点让用户检查。
6. 持久化记录 workflow version/hash、node type/version、输入/输出与 artifact 引用；新编辑的图不能无声明地替代旧 run 的定义。
7. 注册节点要有命名空间和版本，动态启用/停用不改变运行中已锁定的定义；插件能力与实际执行的安全权力不能由卡片是否显示推断。

这些约束由上面的运行时差异推导，必须在下一阶段访谈和 ADR 中选择范围；本阶段没有产品代码或脚手架。
