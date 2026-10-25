# 安全与模块设计：一手证据和设计推论

核查日期：2026-10-08（Asia/Shanghai）。本文是研究材料，不是已经实现或经集成测试的安全承诺。源码在仓库外的临时目录浅克隆，未安装产品依赖。提交时间用于证明近期活动；不能单独证明项目的维护质量、安全性或发布稳定性。

## 候选组件

| 候选 / 官方 GitHub | 许可证 / 维护证据 | 已核查的源码入口 | 优点、限制与复用结论 |
| --- | --- | --- | --- |
| [Node.js](https://github.com/nodejs/node) | 核心 MIT；随附第三方代码分别列在 LICENSE。HEAD `855e3f74`，2026-10-08。[许可证](https://github.com/nodejs/node/blob/855e3f74b5868bd9a560e95dd82d70da92e307e3/LICENSE) | [`lib/child_process.js`](https://github.com/nodejs/node/blob/855e3f74b5868bd9a560e95dd82d70da92e307e3/lib/child_process.js)、`lib/internal/child_process.js` | **Adopt** Node LTS 作为本地执行宿主。已有进程、流、AbortSignal、文件系统能力；进程权限继承宿主，cwd 和 JS permission model 不等于恶意代码沙箱。生产版本按 LTS 选择，而非 main。 |
| [Execa](https://github.com/sindresorhus/execa) | MIT；HEAD `63ddae6a`，2026-10-06，源码 package 为 10.1.0、Node >=22。[许可证](https://github.com/sindresorhus/execa/blob/63ddae6aeb6934da06fdb3754647791e58cd87c3/license) | [`index.js`](https://github.com/sindresorhus/execa/blob/63ddae6aeb6934da06fdb3754647791e58cd87c3/index.js)、`lib/arguments/options.js`、`lib/terminate/{timeout,cancel,kill,kill-descendants}.js` | **Compose** Shell/Check executor。复用参数传递、结果归一化、流、timeout、cancelSignal、forceKillAfterDelay 和 killDescendants；授权、文件访问隔离与密钥策略仍属宿主。默认 extendEnv=true、killDescendants=false，必须有明确宿主策略。Windows 的子树终止为 best effort。 |
| [Zod](https://github.com/colinhacks/zod) | MIT；HEAD `0b216ef6`，2026-10-02；源码 package 4.6.5。[许可证](https://github.com/colinhacks/zod/blob/0b216ef674e297ebe41d8bf902262e56f8755822/LICENSE) | [`packages/zod/src/index.ts`](https://github.com/colinhacks/zod/blob/0b216ef674e297ebe41d8bf902262e56f8755822/packages/zod/src/index.ts)、`src/v4/core/registries.ts`、`src/v4/core/to-json-schema.ts`、`src/v4/classic/from-json-schema.ts` | **Adopt** 内建节点的 TS 类型与运行时校验；**Extend** 节点描述元数据。Zod registry 管理 schema 元数据，不能替代 executable node/plugin registry。JSON Schema 导出有不可表示类型；反向转换在官方文档中仍属实验功能。 |
| [Ajv](https://github.com/ajv-validator/ajv) | MIT；HEAD `f177fe32`，2026-04-24，源码 package 8.20.0；此快照活动比其他候选稀疏，不能据此判定停止维护。[许可证](https://github.com/ajv-validator/ajv/blob/f177fe323420ccb23e1a79445fd470cbf80aee7c/LICENSE) | [`lib/2020.ts`](https://github.com/ajv-validator/ajv/blob/f177fe323420ccb23e1a79445fd470cbf80aee7c/lib/2020.ts)、`lib/core.ts`、`lib/compile/validate/index.ts` | **Compose（条件采用）** 用户声明的 JSON Schema 校验。若 MVP 仅内建 TS 插件，可先只用 Zod；若允许任意 JSON schema，则复用 Ajv，避免自写验证器或假设 Zod 转换完全无损。schema 编译也有资源消耗与正则风险。 |
| [XState](https://github.com/statelyai/xstate) | MIT；HEAD `6dc2adf4`，2026-10-07；`packages/core/package.json` 为 5.33.2。[许可证](https://github.com/statelyai/xstate/blob/6dc2adf46b4f6a96f7607dff0cdbdcd5933136f8/LICENSE) | [`packages/core/src/createActor.ts`](https://github.com/statelyai/xstate/blob/6dc2adf46b4f6a96f7607dff0cdbdcd5933136f8/packages/core/src/createActor.ts)、`StateMachine.ts`、`guards.ts`、`actors/promise.ts` | **Compose（备选）** 复杂 UI 或审批状态机；当前 **不作为 graph kernel**。状态图、actor 层级与用户的端口数据流并非相同模型。快照能保存 actor 状态，但外部 I/O 的幂等性仍需宿主解决。[官方持久化文档](https://stately.ai/docs/persistence) |
| [Hono](https://github.com/honojs/hono) + [Node adapter](https://github.com/honojs/node-server) | 两者 MIT；Hono HEAD `f78a245a`，2026-10-08，源码 4.13.13；adapter HEAD `d57ed9b9`，同日、2.1.4。[Hono license](https://github.com/honojs/hono/blob/f78a245abc393368583085e19c7f5b28b460bf51/LICENSE)、[adapter license](https://github.com/honojs/node-server/blob/d57ed9b9dad4d44b20caa0cdb1b10d8360d8b734/LICENSE) | [`src/hono.ts`](https://github.com/honojs/hono/blob/f78a245abc393368583085e19c7f5b28b460bf51/src/hono.ts)、`src/helper/streaming/{index,sse}.ts`；adapter `src/{index,server}.ts` | **Compose** 本地控制接口、SSE 事件流。Web Standards/路由/流组件减少重复实现；认证、run 生命周期与事件持久化由宿主处理。浏览器断开 SSE 不应直接销毁 run。[streaming helper](https://hono.dev/docs/helpers/streaming) |
| [Moby / Docker Engine](https://github.com/moby/moby) | Apache-2.0；HEAD `1f8c9a5b`，2026-10-08。[license](https://github.com/moby/moby/blob/1f8c9a5b842eb0d35daea75e97a8745caa924d93/LICENSE)。Docker Desktop 是另一个发行产品，不可把 Engine 许可证套用到 Desktop。 | [`daemon/start.go`](https://github.com/moby/moby/blob/1f8c9a5b842eb0d35daea75e97a8745caa924d93/daemon/start.go)、`daemon/container_operations.go`、`daemon/server/server.go` | **Compose（可选本地、公开部署必须另行评估）** 隔离 executor。复用容器、资源限制、namespace、网络与挂载机制；不复制容器运行时。需管理 daemon 权限、镜像、挂载、网络和系统差异；普通容器不是多租户敌对代码的充分安全证明。 |
| [React](https://github.com/facebook/react) | MIT；HEAD `b618bbb4`，2026-10-07。[license](https://github.com/facebook/react/blob/b618bbb4422693bbb8d387180687b3f510300f42/LICENSE) | [`packages/react/index.js`](https://github.com/facebook/react/blob/b618bbb4422693bbb8d387180687b3f510300f42/packages/react/index.js)、`packages/react/src/ReactClient.js` | **Adopt** 用户已选前端基础。运行记录与画布编辑状态应独立，组件重新渲染不能重新触发后端节点。main 的实验 flags 不作为稳定版能力承诺。 |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | MIT；HEAD `01321746`，2026-10-08。[license](https://github.com/shadcn-ui/ui/blob/0132174664c07d41262fb51012d0cc782e458e6c/LICENSE.md) | [`apps/v4/registry/bases/radix/ui/dialog.tsx`](https://github.com/shadcn-ui/ui/blob/0132174664c07d41262fb51012d0cc782e458e6c/apps/v4/registry/bases/radix/ui/dialog.tsx)、同级 `button.tsx`、`tabs.tsx`、`command.tsx` | **Adopt + Extend** 属性面板、快捷命令、弹窗、表单和设计 token。它交付可维护源码而非整套 workflow 产品；复制后需负责更新。当前 registry 提供多个 base，MVP 选一个，避免混用基础组件系统。[官方介绍](https://ui.shadcn.com/docs) |
| [Radix Primitives](https://github.com/radix-ui/primitives) | MIT；HEAD `8f8d20ee`，2026-10-08。[license](https://github.com/radix-ui/primitives/blob/8f8d20ee4e4499c5c8a718fabebcb75203966711/LICENSE) | [`packages/react/dialog/src/dialog.tsx`](https://github.com/radix-ui/primitives/blob/8f8d20ee4e4499c5c8a718fabebcb75203966711/packages/react/dialog/src/dialog.tsx)、`packages/react/{tabs,tooltip,dropdown-menu}/src/` | **Compose** 作为选定 shadcn base 的无障碍行为基础；复用 focus/keyboard/ARIA，不并行创建第二套 design system。库能力不等于整张图已经可访问，画布交互仍需验收。[官方介绍](https://www.radix-ui.com/primitives/docs/overview/introduction) |

## 本地 Shell：权限与运行可靠性

**事实**：Node `spawn` 允许独立 executable/args、cwd、env、timeout 与 AbortSignal；`exec` 会启动 shell。cwd 只选择进程起点。Node Permission Model 官方明确不为恶意代码建立安全保证；允许 child process 也不能约束子进程的全部行为。[child process 文档](https://nodejs.org/api/child_process.html)、[Permission Model 文档](https://nodejs.org/api/permissions.html)

**设计推论**：本地 MVP 的 Shell 节点分成受限的 command 节点和用户明确授权的 arbitrary shell 节点。受限模式传 executable 与 args，禁用 shell；不要靠字符串黑名单把 arbitrary shell 宣称为安全。读取/写入工具做 realpath、目录归属、symlink 检查，但一个已经获准运行的 shell 仍能使用宿主权限访问别处。单独工作目录/Git worktree 是变更隔离，不是 OS 权限隔离。

Execa 当前源码默认继承父环境。宿主应显式设置 `extendEnv: false`，仅注入必要的 PATH/SystemRoot 等变量与该工具需要的 secret，不能把所有 Provider API key 传进 build 或 shell。启动权限核对 workflow revision、节点能力、目标目录、命令与网络策略；批准记录不能随着图修改继续无条件复用。[Execa options 源码](https://github.com/sindresorhus/execa/blob/63ddae6aeb6934da06fdb3754647791e58cd87c3/lib/arguments/options.js)

复用 Execa 的 timeout、cancelSignal、强制终止和日志流。`killDescendants` 为 opt-in：Unix 利用进程组；Windows 利用 `taskkill /T /F`，父进程退出后不能可靠枚举所有后代，失败时退回杀直接子进程。对失控/逃逸后台进程只能声明 best effort。更严格的 Windows 生命周期控制可用已有 Job Objects；公开执行不要自行写不完整的进程沙箱。[Execa subtree 源码](https://github.com/sindresorhus/execa/blob/63ddae6aeb6934da06fdb3754647791e58cd87c3/lib/terminate/kill-descendants.js)、[Windows Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)

输出流必须持续消费、限字节、限速，并把大型日志/截图作为 artifact；超时、取消、非零 exit、断网分别归一化为可路由的 outcome。可视化 Trace 要同时记录 invocation ID、node ID、attempt、loop iteration、parent invocation、起止时间及结果；不能只为一个静态 node 保留最后一条状态。

## 当前本地 MVP 与未来公开部署

| 事项 | 本地单用户 MVP（建议，待访谈确认） | 公开服务/不可信用户（单独阶段） |
| --- | --- | --- |
| 进程与文件 | 明确可信 workspace；变更可选 worktree；明确授权 shell 的宿主权限 | 每 run/租户隔离 executor；最小挂载；非特权用户；资源限制；tenant ACL；更强隔离按威胁模型评估 |
| 网络 | 后端绑定 loopback；验证 Origin/Host 与会话授权；限制可写控制接口 | 身份认证、租户授权、egress allowlist/代理、SSRF 防护、配额与审计 |
| 密钥 | 后端环境或内存；图中只有 credential reference；浏览器 bundle、workflow export 和 trace 中无 key；Shell 仅获其所需环境 | 托管 secret store、轮转、短期凭证、每租户 key 引用、授权审计、日志脱敏 |
| 恢复 | 可保存 trace/完成步骤；中断的副作用标记 unknown 并请用户处理 | 持久 journal/checkpoint、幂等键、资源租约、外部结果协调；不能泛称 exactly-once |
| 插件 | 首批使用受信任、静态打包的 TS registry；禁用来自图文件的任意动态 import | 制品来源/签名、隔离执行、插件权限/版本、依赖与漏洞治理 |

以上为本项目的设计判断。loopback 服务仍会遇到浏览器跨站请求，CORS 不能当作认证；secret 不该记录在日志中。[OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)、[OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

Docker 已有网络隔离、rootless 和只读挂载机制，可组合为后续 executor。`--network none` 会同时阻断需要联网的模型/包安装，因此 Model gateway 与代码执行网络策略宜分开。bind mount 默认可写；禁止挂载 Docker socket、宿主 home 和所有 credentials。公开运行需结合 seccomp/capabilities/CPU-memory-pids 限制等，不能仅因为“在 Docker 里”就认定完成安全隔离。[none network](https://docs.docker.com/engine/network/drivers/none/)、[rootless](https://docs.docker.com/engine/security/rootless/)、[bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)、[Engine security](https://docs.docker.com/engine/security/)

## 类型化节点与执行模型：推论，不是实现

1. Workflow document 使用可序列化 JSON：document/schema 版本、节点 type/version/config/enabled、端口 ID、输入 binding、带端口的边、entry/output 和 budgets。画布 position/viewport 属 editor 元数据。Zod function/schema object、Promise、SDK Model 实例、credential 值不写进 JSON。
2. NodeDefinition（注册描述）与 NodeInstance（图中实例）分开。Definition 持有 input/output/config validators、端口、UI 元数据与 executor factory；runtime 执行模块和浏览器 renderer 分开注册，服务端 capabilities 不进入浏览器包。
3. TypeScript 泛型保证已编写插件的类型；导入 JSON 仍必须运行时验证。Zod 导出 JSON Schema 用于 UI/schema 描述，不能声称实现完整的 schema assignability。MVP 先支持确定的 port kind 与少量结构规则，最终 input/output 实值都校验。
4. 用户 schema 如成为硬需求，采用 Ajv 的正确 draft（2020-12 使用对应入口），限制大小、深度、refs 和正则；不要允许图文件将任意 URL `$ref` 自动变成网络请求。[Ajv security](https://ajv.js.org/security.html)、[Ajv 源码](https://github.com/ajv-validator/ajv/blob/f177fe323420ccb23e1a79445fd470cbf80aee7c/lib/2020.ts)
5. Mapping 先选字面量、状态字段、前次 invocation 的输出引用与有限路径规则；为允许的路径定义不可变读和缺值错误。禁止为了灵活性直接 eval。独立表达式语言是后续候选，未做比较前不新增默认依赖。
6. 数据值与控制令牌分开。每次激活一个节点实例的 invocation；返回 output、显式 state update、selected port/outcome；Kernel 路由控制边。Router/Decision 可以是纯规则节点，不需要模型。避免同时宣称任意 cyclic dataflow、DAG 全就绪调度和单线程流程都是默认语义。
7. MVP 建议顺序执行、显式入口、显式回边、次数/时间限制；每轮输出带 activation/iteration 标识，以免读取上轮旧值。fan-out/fan-in 的 parallel 和 merge policy 属访谈后的扩展，而不是偷偷加进小 Kernel。
8. enabled=false 不应默认为“把所有上游输出接给所有下游”。只在声明 identity/pass-through 的端口上自动旁路；否则需要映射或编译错误。替换节点校验 type/version/schema/port 引用；组合卡片声明 exposed ports 与内图输入输出映射。
9. 组合节点调用同一个 Kernel 执行 versioned subgraph，并继承预算、取消信号和能力限制；子节点 trace 保留 parent invocation。图上的 group 仅是 UI 容器，不能自动视作已建立 subgraph runtime。递归自引用至少需要深度限制，MVP 可拒绝。
10. EventSink / CheckpointStore / CapabilityHost 是注入 seam。Kernel 不认识 Provider、数据库、React Flow、shell binary 或日志渲染；编译验证与用户的 Check 节点也要区分：前者保证图可执行，后者产出业务验证结果。

## 预置工作流语义

Ralph 原作者将其解释为不断重新运行 coding agent 的循环，并强调每轮任务、上下文安排和验证反馈。它不是统一 SDK 协议，也不能把所有聊天中的多次 tool call 都命名为 Ralph。[Geoffrey Huntley 原文](https://ghuntley.com/ralph/)

本项目建议：简单聊天是一轮 Model→输出；Coding Agent 是 Model→Tool→Context→Model 的子图；Ralph 是为每轮重新构造 context 的外循环，连接 coding 子图与显式验证/停止条件；自主软件开发再加入计划/任务选择/实现/验证/人工关口。四者都是 graph 模板，不是 Kernel 内的四种特判。是否每轮清空模型对话、怎样保留任务进度，以及“完成”判据应在需求访谈中确认。

## 必须在实现阶段验证的反例

本轮没有执行这些产品测试。后续用成熟 Vitest/Playwright 工具验证：禁用不同 schema 的节点不能静默旁路；回边不能读取旧 iteration；嵌套子图取消能传播；Model 请求 tool 后每个 tool call 恰有结果；Shell 执行后、checkpoint 前崩溃不能自动重做；取消能清理模型请求和正常子树；日志超量仍可停止；恶意 Origin 和跨目录 symlink 不能绕过受限 file tool；导出图和 trace 不包含 credential；纯确定性图在无 Provider key 下可运行。
