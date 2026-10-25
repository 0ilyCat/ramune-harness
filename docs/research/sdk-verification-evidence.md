# 大模型 SDK 与验证：源码证据

调研日期：2026-10-08（Asia/Shanghai）。范围：用户任务 C / D；所有建议都属于设计判断，尚未实现、安装依赖、运行模型请求或执行产品测试。研究采用 Matt Pocock `research` 技能要求的官方文档、原始源码和包元数据；OpenAI 部分同时查阅官方 OpenAI documentation。

## 结论与边界

推荐 **Compose Vercel AI SDK Core + 官方 Provider adapters，Adopt Playwright / TypeScript CLI / Vite / Vitest**。Kernel 自己决定下一张卡片、边、循环、预算与恢复；Model 节点只执行一次模型调用，返回文本、结构化输出或工具调用。工具的 Schema 交给 SDK，工具的实际运行交给可观察、可授权的 Tool 节点。

不要给 Model 节点注册会自动执行的 `execute` 回调，再误以为单步停止条件能阻止工具执行。当前源码默认 `stopWhen = isStepCount(1)`，但先执行工具，最后才判断是否继续下一次模型生成。源码和测试均证明这一点：[默认停止条件](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/ai/src/generate-text/generate-text.ts#L247)、[工具执行入口](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/ai/src/generate-text/generate-text.ts#L1342)、[循环末尾判断](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/ai/src/generate-text/generate-text.ts#L1522)、[未指定 stopWhen 的工具结果测试](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/ai/src/generate-text/generate-text.test.ts#L2210)。

正确组合方式：提供不带 `execute` 的工具定义，SDK 解析/验证模型生成的调用；Kernel 路由到 Tool 卡片，记录 call ID、输入、输出、错误、权限与耗时，再把工具结果加入下一次 Model 节点的消息输入。SDK 明确支持这种外部执行方式：[Tool Calling 文档](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)、[非 executable 工具返回 undefined 的实现](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/ai/src/generate-text/execute-tool-call.ts#L89)、[不带 execute 的测试](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/ai/src/generate-text/generate-text.test.ts#L4338)。不启用 `ToolLoopAgent`、SDK workflow/harness 等拥有另一套循环的顶层封装；如果未来提供不展开的组合 Agent 卡片，必须把内部步骤作为子 trace 显示，并明确它的预算归属。

## 版本、许可证与维护快照

以下 published 是 npm registry 对该版本记录的 **UTC 时间**，不是 GitHub UI 的本地时间或本文日期。通过 registry 直接读取 `dist-tags.latest`、`versions`、`time`，未安装包。GitHub 公共 API 在本次查询中达到匿名限额；因此不虚构“最近提交日期”，用实际发布时间、可读 release notes、`git ls-remote HEAD` 和固定源码 SHA 建立维护证据。最新版本仅为研究快照，实施时再核对 peer dependencies 并锁版本。

| 候选 / 官方仓库 | 核验许可证 | stable npm 版本 / published UTC | 维护结论及证据 |
| --- | --- | --- | --- |
| [Vercel AI SDK](https://github.com/vercel/ai) | [Apache-2.0](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/LICENSE) | `ai 7.0.133` / `2026-10-08T00:30:36.255Z` | 活跃：当天稳定包发布；[release notes](https://github.com/vercel/ai/releases/tag/ai%407.0.133) 与 [npm metadata](https://registry.npmjs.org/ai)；HEAD `4bed111f7779e603a7964efd7c87894bb45be9f4`，源码 package.json 同为 7.0.133 |
| [OpenAI JS SDK](https://github.com/openai/openai-node) | [Apache-2.0](https://github.com/openai/openai-node/blob/bc6c0bfb70f253d5caa3f335699e9713ea9067b5/LICENSE) | `openai 7.30.1` / `2026-10-08T09:01:13.110Z` | 活跃：[当天 release](https://github.com/openai/openai-node/releases/tag/v7.30.1)、[npm metadata](https://registry.npmjs.org/openai)；HEAD `bc6c0bfb70f253d5caa3f335699e9713ea9067b5` |
| [Playwright](https://github.com/microsoft/playwright) | [Apache-2.0](https://github.com/microsoft/playwright/blob/4357c237cfde9135fb5b7894c22a45468321a973/LICENSE) | `@playwright/test 1.64.0` / `2026-10-07T20:44:27.702Z` | 活跃：[最新 release](https://github.com/microsoft/playwright/releases/tag/v1.64.0)、[npm metadata](https://registry.npmjs.org/%40playwright%2Ftest)；HEAD `4357c237cfde9135fb5b7894c22a45468321a973`；HEAD 与发布 commit 不等同 |
| [TypeScript](https://github.com/microsoft/TypeScript) | [Apache-2.0](https://github.com/microsoft/TypeScript/blob/c0ca4744c917430282a7de06c3e8f22d2cb87353/LICENSE.txt) | `typescript 7.0.2` / `2026-07-08T15:55:18.431Z` | 活跃：已完成原生编译器迁移，仍发布 nightly；[npm metadata](https://registry.npmjs.org/typescript)、[release](https://github.com/microsoft/TypeScript/releases/tag/v7.0.2)、[官方 7.0 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)；HEAD `c0ca4744c917430282a7de06c3e8f22d2cb87353` |
| [Vite](https://github.com/vitejs/vite) | [MIT](https://github.com/vitejs/vite/blob/b6c20f6a8126d8561891e5fb9368e8fc9da37538/LICENSE) | `vite 8.3.4` / `2026-10-08T12:07:04.441Z` | 活跃：[当天 release](https://github.com/vitejs/vite/releases/tag/v8.3.4)、[npm metadata](https://registry.npmjs.org/vite)；HEAD `b6c20f6a8126d8561891e5fb9368e8fc9da37538` |
| [Vitest](https://github.com/vitest-dev/vitest) | [MIT](https://github.com/vitest-dev/vitest/blob/3e3624c5e5ecf77b20065da1aeb60f1182db0ccd/LICENSE) | `vitest 5.0.3` / `2026-09-30T11:30:42.429Z` | 活跃：[release 修复记录](https://github.com/vitest-dev/vitest/releases/tag/v5.0.3)、[npm metadata](https://registry.npmjs.org/vitest)；HEAD `3e3624c5e5ecf77b20065da1aeb60f1182db0ccd`，HEAD 与发布 commit 不等同 |
| [ESLint](https://github.com/eslint/eslint) | [MIT](https://github.com/eslint/eslint/blob/b92decf8ead7cc4082a18a4a0ab28f3c7c589887/LICENSE) | `eslint 10.12.0` / `2026-10-02T20:08:19.213Z` | 活跃：[release 规则修复记录](https://github.com/eslint/eslint/releases/tag/v10.12.0)、[npm metadata](https://registry.npmjs.org/eslint)；HEAD `b92decf8ead7cc4082a18a4a0ab28f3c7c589887` |

License 为核验到的仓库/主包 License；分发浏览器、平台原生二进制和传递依赖时仍需保留各自 notices。本表只表达已有发布活动，不声称维护 SLA、故障率或已跑过兼容验证。

### AI SDK 各包并非同一个版本号

| stable 包 | published UTC | Node engines | peers / 组合约束 |
| --- | --- | --- | --- |
| [`ai 7.0.133`](https://registry.npmjs.org/ai/7.0.133) | 2026-10-08T00:30:36.255Z | `>=22` | Zod `^3.25.76 || ^4.1.8` |
| [`@ai-sdk/react 4.0.136`](https://registry.npmjs.org/%40ai-sdk%2Freact/4.0.136) | 2026-10-08T00:28:59.836Z | `>=22` | React `^18 || ~19.0.1 || ~19.1.2 || ^19.2.1`；依赖 **ai 7.0.133** |
| [`@ai-sdk/openai 4.0.89`](https://registry.npmjs.org/%40ai-sdk%2Fopenai/4.0.89) | 2026-10-08T00:29:36.356Z | `>=22` | Zod 同上 |
| [`@ai-sdk/anthropic 4.0.76`](https://registry.npmjs.org/%40ai-sdk%2Fanthropic/4.0.76) | 2026-10-08T00:31:35.587Z | `>=22` | Zod 同上 |
| [`@ai-sdk/openai-compatible 3.0.66`](https://registry.npmjs.org/%40ai-sdk%2Fopenai-compatible/3.0.66) | 2026-10-08T00:28:54.575Z | `>=22` | Zod 同上 |

这些 stable SDK 包均引用 `@ai-sdk/provider 4.0.25`、`@ai-sdk/provider-utils 5.0.57`，源码为 Provider V4；registry 同时存在 `ai-v6`/`ai-v5` 分支标签，它们不能与当前 stable adapters 混搭。搜索缓存里出现的 `stepCountIs`、旧 `parameters` 等示例不能直接当作 7.x 接口。当前源码是 `isStepCount` 和 `inputSchema`。这些包元数据是可安装兼容性的必要条件，不能代替实际安装后的 Type Check、冒烟测试。

## C. SDK 方案逐项比较

### Vercel AI SDK Core：组合成熟能力，自研薄模型卡片适配器

源码入口（均实际读取）：

- [`packages/ai/src/generate-text/generate-text.ts`](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/ai/src/generate-text/generate-text.ts)：生成、工具调用解析、retry、abort、停止条件。
- [`packages/ai/src/generate-text/stream-text.ts`](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/ai/src/generate-text/stream-text.ts)：模型流、结果聚合和流事件。
- [`packages/ai/src/generate-text/output.ts`](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/ai/src/generate-text/output.ts)：结构化输出规格；[`execute-tool-call.ts`](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/ai/src/generate-text/execute-tool-call.ts)：工具 execution 与回调。
- [`packages/ai/src/registry/provider-registry.ts`](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/ai/src/registry/provider-registry.ts)：按 provider/model ID 注册；[`官方 Provider Management`](https://ai-sdk.dev/docs/ai-sdk-core/provider-management)。
- [`packages/openai/src/openai-provider.ts`](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/openai/src/openai-provider.ts)、[`packages/openai-compatible/src/openai-compatible-provider.ts`](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/openai-compatible/src/openai-compatible-provider.ts)：官方 OpenAI 与兼容端点工厂。
- [`packages/react/src/use-chat.ts`](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/react/src/use-chat.ts)：可选聊天 UI 接口，不能代替整个工作流 run 的状态协议。

优点：多供应商用同一调用层，已有 Schema、流式、工具调用、usage、错误分类、abort 与重试机制；减少各 Provider 反复实现 HTTP/SSE/模型消息转换。具体能力仍取决于 provider adapter 与模型；应优先用官方原生 adapter，把兼容 adapter 当作扩展口。

缺点：API 迭代快，多包版本独立；provider-specific reasoning、缓存、工具、文件等能力不完全相同；高层 agent/harness 会引入第二个调度器。兼容模式不能保证模型有结构化输出、多模态工具结果、usage 或完整 reasoning 语义。官方兼容 adapter 要显式设置 `supportsStructuredOutputs` 和多段工具内容支持，不能只换 base URL 就宣称全兼容：[OpenAI Compatible Providers](https://ai-sdk.dev/providers/openai-compatible-providers)。

直接复用：生成/流式接口、原生 adapters、registry、Schema 转换与验证、工具调用解析、typed errors、usage、AbortSignal。自建内容严格限于 Harness 的薄适配：把 SDK 输出映射到节点结果与 run events。Kernel 不依赖 SDK 类型或模型必须存在，LLM-free 的确定性工作流应仍能运行。对 provider warnings、未报告 usage、incomplete/refusal、部分流中断保留显式状态，禁止把半截流当成功输出。

重试属于模型请求层；工具副作用重试属于执行策略，必须独立。不要同时开启 SDK 多次 retry 和 Kernel 多次节点 retry，却只记录一次耗时/费用。Source 默认模型 retry 为 2，支持 abort 与 timeout；实现期应为每个 Model 节点配置可见总预算，记录 attempt，而不是复制 retry 算法：[generateText 源码](https://github.com/vercel/ai/blob/4bed111f7779e603a7964efd7c87894bb45be9f4/packages/ai/src/generate-text/generate-text.ts)。

### OpenAI JS SDK：可选专用适配器，跨供应商能力分别评估

源码入口（实际读取）：[`src/client.ts`](https://github.com/openai/openai-node/blob/bc6c0bfb70f253d5caa3f335699e9713ea9067b5/src/client.ts)（请求、重试、timeout、auth）、[`src/resources/responses/responses.ts`](https://github.com/openai/openai-node/blob/bc6c0bfb70f253d5caa3f335699e9713ea9067b5/src/resources/responses/responses.ts)（Responses API）、[`src/lib/responses/ResponseStream.ts`](https://github.com/openai/openai-node/blob/bc6c0bfb70f253d5caa3f335699e9713ea9067b5/src/lib/responses/ResponseStream.ts)（流式聚合）、[`src/helpers/zod.ts`](https://github.com/openai/openai-node/blob/bc6c0bfb70f253d5caa3f335699e9713ea9067b5/src/helpers/zod.ts)（Schema helpers）、[`src/internal/provider.ts`](https://github.com/openai/openai-node/blob/bc6c0bfb70f253d5caa3f335699e9713ea9067b5/src/internal/provider.ts)、[`src/providers/bedrock.ts`](https://github.com/openai/openai-node/blob/bc6c0bfb70f253d5caa3f335699e9713ea9067b5/src/providers/bedrock.ts)（当前的 Provider 支持）。

优点：OpenAI 特性覆盖直接，SDK 维护者与 API 提供方一致，typed Responses、streaming、Zod helpers、request ID、取消与重试可复用；普通 Responses 调用允许应用自己掌控 tool calling loop。[官方 Function Calling](https://developers.openai.com/api/docs/guides/function-calling)、[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)。

缺点：其 Provider 配置不是 AI SDK 那样的通用模型语义接口。当前 SDK 确实支持 Azure、Amazon Bedrock 等接入，不能描述为“只能调用 OpenAI”；但 Bedrock helper 指向 OpenAI-compatible endpoint，ProviderRuntime 核心处理 baseURL/请求认证，不能据此推断已替你翻译所有原生 Anthropic/Gemini 协议。要覆盖这些原生协议，仍应使用相应 SDK 或成熟 adapter，而非自行写转换层。源码默认 timeout 为 10 分钟、maxRetries=2，不是符合 Harness 节点预算的默认值；显式调整预算，传递 `signal`。[client 源码](https://github.com/openai/openai-node/blob/bc6c0bfb70f253d5caa3f335699e9713ea9067b5/src/client.ts)。

复用决策：MVP 默认使用 AI SDK adapters；当用户明确需要 AI SDK 尚未暴露的 OpenAI 能力时，Compose OpenAI SDK 成另一个 Model/Capability adapter。避免同一请求两套 SDK 叠加。Structured Outputs 只支持 JSON Schema 子集，要处理拒绝和 incomplete；解析 helper 与普通 `create` 的行为也不同，不能仅传 Zod helper 就假设普通 create 返回 typed parsed 对象。[Zod helper 源码](https://github.com/openai/openai-node/blob/bc6c0bfb70f253d5caa3f335699e9713ea9067b5/src/helpers/zod.ts)、[官方结构化输出说明](https://developers.openai.com/api/docs/guides/structured-outputs)。

安全与 UI：SDK 默认禁止浏览器直接携带 secret 使用；保留后端调用、credential reference 和脱敏 trace。浏览器呈现模型流或节点日志不等于把 API key 放前端。[client 的 dangerouslyAllowBrowser 检查](https://github.com/openai/openai-node/blob/bc6c0bfb70f253d5caa3f335699e9713ea9067b5/src/client.ts)。

## D. 验证组件与复用

验证应是可组合 Check 卡片。运行成熟命令，收集退出码与原始报告，把报告映射为稳定的节点输出；不重新实现编译器、测试调度、浏览器驱动或 linter。下列 Check 接入层属于 Build；底层工具 Adopt / Compose。

| 候选与关键源码 | 优点 | 缺点 / 边界 | 直接复用与结论 |
| --- | --- | --- | --- |
| Playwright：[CLI](https://github.com/microsoft/playwright/blob/4357c237cfde9135fb5b7894c22a45468321a973/packages/playwright/src/program.ts)、[test runner](https://github.com/microsoft/playwright/blob/4357c237cfde9135fb5b7894c22a45468321a973/packages/playwright/src/runner/testRunner.ts)、[JSON reporter](https://github.com/microsoft/playwright/blob/4357c237cfde9135fb5b7894c22a45468321a973/packages/playwright/src/reporters/json.ts) | 成熟真实浏览器测试，已有等待、断言、报告与 trace | 浏览器安装/启动成本，拖拽 canvas/坐标要写稳健交互，trace/screenshots 可能含凭据；不能证明整个 UI 美观 | **Adopt** test runner，**Compose** 成 Browser Check；复用 JSON/HTML reporter、trace viewer、webServer 生命周期；不 fork runner |
| TypeScript：[native CLI](https://github.com/microsoft/TypeScript/blob/c0ca4744c917430282a7de06c3e8f22d2cb87353/tsc/cmd/tsc/main.go)、[执行入口](https://github.com/microsoft/TypeScript/blob/c0ca4744c917430282a7de06c3e8f22d2cb87353/tsc/internal/execute/tsc.go)、[checker](https://github.com/microsoft/TypeScript/blob/c0ca4744c917430282a7de06c3e8f22d2cb87353/tsc/internal/checker/checker.go) | 成熟项目类型检查，节点插件 TS 类型能静态检查 | TS 类型不能验证外部 workflow JSON；7.0 没有旧 TS6 programmatic API，类型感知 lint 工具有迁移约束 | **Adopt** `tsc --noEmit` CLI；MVP 优先 CLI/exit code/raw diagnostics，只有明确需要时薄解析 diagnostics；不自研 type checker |
| Vite：[CLI](https://github.com/vitejs/vite/blob/b6c20f6a8126d8561891e5fb9368e8fc9da37538/packages/vite/src/node/cli.ts)、[build API](https://github.com/vitejs/vite/blob/b6c20f6a8126d8561891e5fb9368e8fc9da37538/packages/vite/src/node/build.ts) | React 生态成熟，build 是正式交付门槛，现成配置/插件/产物 | transpile/build 不进行 Type Check；运行项目配置和插件可执行任意代码 | **Adopt** `vite build`，**Compose** 成 Build Check；已有目标仓库优先运行它自己的 build script；不重新写 bundler |
| Vitest：[CLI](https://github.com/vitest-dev/vitest/blob/3e3624c5e5ecf77b20065da1aeb60f1182db0ccd/packages/vitest/src/node/cli.ts)、[JSON reporter](https://github.com/vitest-dev/vitest/blob/3e3624c5e5ecf77b20065da1aeb60f1182db0ccd/packages/vitest/src/node/reporters/json.ts) | 和 Vite/TS 集成直接，有 fake timers/mock/JSON/JUnit reporters，适合确定性 Kernel 合约测试 | 不是类型检查器，也不代替真实浏览器；自定义测试代码拥有执行权限 | **Adopt** `vitest run`，**Compose** 成 Test Check；明确 run 模式而非 watch；原始 JSON 文件直接复用，避免解析彩色终端输出 |
| ESLint：[CLI](https://github.com/eslint/eslint/blob/b92decf8ead7cc4082a18a4a0ab28f3c7c589887/bin/eslint.js)、[Node API](https://github.com/eslint/eslint/blob/b92decf8ead7cc4082a18a4a0ab28f3c7c589887/lib/eslint/eslint.js)、[JSON formatter](https://github.com/eslint/eslint/blob/b92decf8ead7cc4082a18a4a0ab28f3c7c589887/lib/cli-engine/formatters/json.js) | 规则与插件成熟，JSON formatter/Node API 现成 | 不代替 build/test；TS lint 需要对应 parser/plugin；当前 TS7 API 过渡要核验依赖 | 可选 **Adopt/Compose** Lint Check；默认只检查，自动 `--fix` 是另一个有写入副作用的操作 |

相关官方证据：[Playwright reporters](https://playwright.dev/docs/test-reporters)、[webServer](https://playwright.dev/docs/test-webserver)、[trace viewer](https://playwright.dev/docs/trace-viewer)、[TypeScript noEmit](https://www.typescriptlang.org/tsconfig/noEmit.html)、[Vite TypeScript/transpile-only](https://vite.dev/guide/features#typescript)、[Vitest reporters](https://vitest.dev/guide/reporters)、[ESLint formatters](https://eslint.org/docs/latest/use/formatters/)。Vite 当前使用 Rolldown/Oxc，不能套用旧版本“默认 Rollup/esbuild”描述来设计内部集成；本项目只需公开 CLI/API，不依赖 bundler 私有实现。[当前 Vite package.json](https://github.com/vitejs/vite/blob/b6c20f6a8126d8561891e5fb9368e8fc9da37538/packages/vite/package.json)、[官方 Vite Features](https://vite.dev/guide/features#typescript)。

### 工具链版本约束与 TS7 特别注意

当前 npm engines：AI SDK / OpenAI `>=22`；Vite `^20.19.0 || >=22.12.0`；Vitest `^22.12.0 || ^24.0.0 || >=26.0.0`；ESLint `^20.19.0 || ^22.13.0 || >=24`；Playwright `>=20`。因此“任何 Node 22”并不满足整个组合，若采用 Node 22 至少需 **22.13.0**。更简单的后续实施基线是这些 engines 接受的 Node 24，并锁定一个具体补丁版本；本研究未安装或运行这个组合。[各工具 npm 元数据](https://registry.npmjs.org/vitest)、[ESLint](https://registry.npmjs.org/eslint)、[Vite](https://registry.npmjs.org/vite)。

TypeScript 7 是实际已发布的 native Go compiler，当前主仓库路径是 `tsc/internal/...`，旧 `src/compiler/checker.ts` 不再是当前 main 入口。7.0 没有 programmatic API；官方给出 TypeScript 7 CLI 与 TypeScript 6 兼容包并行使用方案（例如需要旧 API 的 typescript-eslint）。推荐先让 Type Check 卡片只调用 CLI；若 MVP 使用 typed ESLint 或 Vitest 的特定 type-test 功能，再核验相应支持，不能默认新 compiler API 已兼容。[官方 TS7 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)。npm 7.0.2 发布记录早于 GitHub release 的重新发布/迁移日期，本文分别记录，不能把 release UI 的 8 月日期当 npm 首次发布时间。

### 检查节点契约：产品设计建议，非上游现成接口

Check 输入建议：工作目录引用、已批准的项目 script/check preset、timeout、artifact root、必要的显式环境变量。输出建议：`status`（passed/failed/error/cancelled/timed_out）、exit code、stdout/stderr artifact references、原生报告、规范化 diagnostics、duration、attempt。Checks 是普通节点，因此 Ralph/Coding preset 可以形成 `Change → Type Check → Build → Test → Browser Check → Router`；Router 按结构化结果决定结束或回环，不让模型解析“看起来成功”的终端文本。

把 verification status 与 process exit 区分：报告写入失败、无测试、配置错误、用户取消、报告损坏、超时不应统一折叠为“测试没通过”。原始报告必须保留，以便 SDK/runner 升级后重新解释。Playwright/Vitest 原生报告不保证所有版本字段相同，薄 adapter 应有版本和未知字段兼容策略。Vitest 官方建议机器消费时写 report 文件，stdout 可能与其他日志交错，污染 JSON；这里优先使用文件 artifact。[Vitest reporter 输出说明](https://vitest.dev/guide/reporters)。

Verification 进程和普通 Shell Tool 同样有执行权限：测试、Vite config、插件、package scripts 可能运行任意代码。它们不能因为名称是 Check 就绕开工作目录/授权/超时/输出限制；在未来公开服务中同样需要隔离执行。这里只提出共同边界，安全具体方案由 E 部分补充。

## 实施后的验证计划（当前阶段不执行）

1. 先锁定 engine/peer-compatible SDK 和工具版本，检查安装树只有预期 provider major；记录 exact package versions 到可重现 lockfile。
2. 对 Model adapter 做离线契约测试：单次生成、工具参数合法/非法、多工具调用、没有 execute 回调、stream cancel、usage 缺失、provider warnings、refusal/incomplete；不以联网模型输出写脆弱 snapshot。
3. 检查 Kernel 不会因为一次 Model visit 自动执行 Tool；每一次工具副作用都有自己的节点 trace、预算、取消与重试策略。只支持 schema-only tool definitions 的默认路径；provider-side tools 则标记远程能力和权限语义，不能伪装为本地 Tool 节点执行。
4. 必要时在真实 Provider 上分别做 text / tool / structured output / streaming / abort 冒烟测试，维护 capability matrix；OpenAI-compatible 不共享一个“全部支持”的布尔标记。模型选择、费用和实际性能属于实施期核验，本研究未测量。
5. Check adapter 验证 0 / 非 0 exit、无测试、超时、取消、损坏报告、超大输出、失败 artifact；Kernel 的测试重点是循环预算、条件路由、disabled-card 行为、resume 后副作用去重，前端重点是拖拽连接/编辑/切换/组合展开/节点检查器。
6. UI 用 Playwright 检查关键任务路径、键盘/焦点、失败与运行状态、布局与截图；在稳定 OS/font/browser 基线上做视觉比较，并人工评审专业视觉质量。浏览器自动化通过不能单独等同“美观”。

## 尚未核验的事项

- 未执行真实 LLM 调用、性能/价格对比、安装兼容或跨系统测试；优缺点是基于源码/文档的设计评估。
- npm 和 GitHub 在同一天持续发布；快照之后可能出现新的版本。对 ai SDK 7 的证据已核验 npm latest，未把仅 HEAD 的版本当作 stable。
- GitHub 匿名 API 限额使最近 commit timestamp 未取得；固定 SHA 已由 Git 远程核验，maintenance 使用可验证的 release/npm 时间，不用 Stars 判断。
- 当实施范围要求更多 OpenAI-specific capabilities 时，应重新评估直接 SDK adapter；本研究不建议预先引入第二套调用实现。
- 本文件是 C/D 证据底稿；最终选型应与 Runtime、Visual Workflow 和 Security 证据合并，保持 Kernel 单一调度权。
