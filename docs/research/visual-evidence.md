# 可视化工作流：源码证据与复用判断

调研期间：2026-10-08 至 2026-10-09（Asia/Shanghai）；下列主分支快照在 10 月 8 日取得。范围：React Flow、Flowise、Langflow、Dify、n8n 的编辑器与执行边界；补充 Dify 已抽离的 Graphon。仅阅读官方仓库、官方文档、官方许可证，未安装依赖、未运行产品、未搭建脚手架。下列源码路径已用 `git ls-tree` 确认存在，并通过 `git show` 阅读；源码克隆位于系统临时目录，不进入本项目。维护判断来自提交和官方生命周期公告，不采用 Stars。

**建议：Adopt React Flow；Compose 免费 React Flow UI/shadcn 组件；Build 领域节点契约、版本化工作流及运行追踪视图；不把现成低代码平台的编辑器和运行时一并搬入 tiny kernel。** 这是基于下面证据的架构判断，不是性能实测。现成画布解决拖拽、连接、选择、视口和布局表达；工作流的执行语义仍需由 ramune-harness 明确掌握。

## 1. 版本与维护证据

这些 SHA 是调研读取的分支 HEAD 快照，不代表发布版本，也不是对未来维护的保证。

| 候选 | 官方 GitHub | 已读快照与日期 | 维护判断 / 证据 |
| --- | --- | --- | --- |
| React Flow / xyflow | [xyflow/xyflow](https://github.com/xyflow/xyflow) | [`3d35b57317576b0916c0bfeaaedd573aaacc2839`](https://github.com/xyflow/xyflow/commit/3d35b57317576b0916c0bfeaaedd573aaacc2839)，2026-09-24 | 近期版本变更提交；快照 `@xyflow/react` 为 12.12.0。[package.json](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/packages/react/package.json) |
| Flowise | [FlowiseAI/Flowise](https://github.com/FlowiseAI/Flowise) | [`9291856d1ea4a4ceea9f8fef8ce14f4f6c81e8eb`](https://github.com/FlowiseAI/Flowise/commit/9291856d1ea4a4ceea9f8fef8ce14f4f6c81e8eb)，2026-08-13 | **已结束官方维护**。官方宣布 7 月 29 日冻结功能、8 月 31 日 EOL；GitHub 显示实际归档日期为 8 月 13 日，不应误写为公告计划的 8 月 10 日。[官方公告](https://flowiseai.com/sunset)、[GitHub 归档提示](https://github.com/FlowiseAI/Flowise/blob/main/LICENSE.md) |
| Langflow | [langflow-ai/langflow](https://github.com/langflow-ai/langflow) | [`504c02fc47e76087b82b0e7cbe4186e9cdd916d4`](https://github.com/langflow-ai/langflow/commit/504c02fc47e76087b82b0e7cbe4186e9cdd916d4)，2026-10-06 | 近期提交合入 `release-1.12.5`；存在运行时和编辑器的持续变更，维护活跃。该合并提交不等同于已核实最新发布版本。 |
| Dify | [langgenius/dify](https://github.com/langgenius/dify) | [`2b65f0e8930964ce2be9e7054dde5a2cd74ff605`](https://github.com/langgenius/dify/commit/2b65f0e8930964ce2be9e7054dde5a2cd74ff605)，2026-10-08 | 当日有类型与测试变更，维护活跃；执行层正在使用独立 Graphon 包，旧版文章中的目录结构可能已过期。 |
| n8n | [n8n-io/n8n](https://github.com/n8n-io/n8n) | [`03f7c76acdca8510ad65b49a78578e42819d708a`](https://github.com/n8n-io/n8n/commit/03f7c76acdca8510ad65b49a78578e42819d708a)，2026-10-08 | 当日仍有 runtime/MCP API 变更，维护活跃；当前前端路径为 `packages/frontend/editor-ui`，不能继续引用旧 `packages/editor-ui`。 |
| Graphon（补充） | [langgenius/graphon](https://github.com/langgenius/graphon) | [`0384e3f4958a723ccb135175f6ca3fabfbc932a8`](https://github.com/langgenius/graphon/commit/0384e3f4958a723ccb135175f6ca3fabfbc932a8)，2026-09-24 | 近期独立 Python 引擎；当前 Dify 固定依赖 `graphon==0.7.0`。仍处演进期，不能把主分支代码视为稳定 API。[Dify 依赖](https://github.com/langgenius/dify/blob/2b65f0e8930964ce2be9e7054dde5a2cd74ff605/api/pyproject.toml) |

## 2. 许可证：编辑器、运行时分别判断

许可证结论依据所读文本；后续复制具体文件时还需保留该文件通知及第三方许可证。这里的结论用于技术选型，不承诺任何尚未定义的公开部署方式已被许可。

| 候选 | 根目录 / 子目录真实许可 | 对本项目的影响 |
| --- | --- | --- |
| React Flow | MIT。[固定版本 LICENSE](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/LICENSE) | 可以直接依赖核心库；官方免费示例可复用。**Pro 示例和完整 AI Workflow Editor 模板需订阅获取**，不能把核心库 MIT 推导为可以无授权获得付费源码。[示例分类](https://reactflow.dev/examples)、[AI 模板](https://reactflow.dev/ui/templates/ai-workflow-editor) |
| Flowise | 通常 Apache-2.0；`packages/server/src/enterprise/` 及带显式商业版权声明的文件（包括 `IdentityManager.ts`）为 Commercial License；第三方保留其自身许可。[LICENSE.md](https://github.com/FlowiseAI/Flowise/blob/9291856d1ea4a4ceea9f8fef8ce14f4f6c81e8eb/LICENSE.md) | 不能整仓视为 Apache。即使筛掉商业代码，归档状态仍使长期依赖不合适。 |
| Langflow | MIT。[LICENSE](https://github.com/langflow-ai/langflow/blob/504c02fc47e76087b82b0e7cbe4186e9cdd916d4/LICENSE) | 若接受 Python 后端，适合合法 fork/extend；不意味着 UI 能低成本独立嵌入。 |
| Dify | Dify 自定义许可，基于 Apache-2.0 且附条件：多租户环境需书面授权；使用前端不可移除/修改 Logo 与版权信息，前端明确包含 `web/` 全部组件。文本另声明交互设计受外观专利保护。[LICENSE](https://github.com/langgenius/dify/blob/2b65f0e8930964ce2be9e7054dde5a2cd74ff605/LICENSE) | 品牌独立、未来多租户的可视化 harness 不宜复制 Dify 前端。可研究交互模式，避免照搬受限制代码/外观。后端单独使用与前端复制的约束不同。 |
| n8n | 主分支通常 Sustainable Use License；名称含 `.ee.` 或目录含 `.ee` 为 Enterprise License；根许可声明非 `master` 分支不被该许可授权；独立第三方组件遵从自身许可。[LICENSE.md](https://github.com/n8n-io/n8n/blob/03f7c76acdca8510ad65b49a78578e42819d708a/LICENSE.md) | 个人/内部业务可用不等于允许公开提供编辑工作流产品。官方说明外部用户通过自有 UI、API、MCP 或代理配置工作流也需商业许可。[官方 use-case FAQ](https://support.n8n.io/article/can-i-use-your-license-for-my-use-case)、[OEM](https://n8n.io/oem/) |
| Graphon | 独立仓库为标准 Apache-2.0，与 Dify 前端自定义许可不同。[LICENSE](https://github.com/langgenius/graphon/blob/0384e3f4958a723ccb135175f6ca3fabfbc932a8/LICENSE) | 可以单独考虑作为 Python 引擎，不必为复用引擎而复制 Dify console。TypeScript 目标与成熟度仍是取舍。 |

## 3. React Flow：直接采用画布，领域语义另行组合

### 已核实入口

- `packages/react/src/container/ReactFlow/index.tsx`：顶层 React 画布。[源码](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/packages/react/src/container/ReactFlow/index.tsx)
- `packages/react/src/components/Handle/index.tsx`：连接端点；`packages/system/src/types/{nodes,edges}.ts`：底层图数据。[Handle](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/packages/react/src/components/Handle/index.tsx)、[edge types](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/packages/system/src/types/edges.ts)
- `packages/react/src/types/general.ts`：`NodeTypes` 是组件注册映射，`IsValidConnection` 是连接校验接口。[源码](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/packages/react/src/types/general.ts)
- `packages/react/src/hooks/useReactFlow.ts`：`toObject()` 保存 `nodes`、`edges`、`viewport`；节点更新、边更新与视口操作属于画布状态。[源码](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/packages/react/src/hooks/useReactFlow.ts)

### 节点 / 端口 / 工作流 JSON

每个 Handle 可以有稳定 `id`，边通过 `sourceHandle`/`targetHandle` 区分端口。新增、移除或移动动态端口需通知 `useUpdateNodeInternals`。这足以表达 Model 的 message 输入与 Tool 的 result 输出，但 UI 端口类型不是 JSON Schema，也不自动验证运行数据。[官方 Handles 文档](https://reactflow.dev/learn/customization/handles)

`parentId` 和子节点相对坐标解决视觉分组；父节点应排在子节点之前。**视觉 sub-flow 不是有输入输出契约、隔离状态、可递归调用的运行组合节点**。后者需要领域层定义边界与映射，不应由画布层猜测。[官方 Sub Flows](https://reactflow.dev/learn/layouting/sub-flows)

**设计判断**：保存文件包含独立的 `schemaVersion`、领域图（节点 type/version/config/enabled、端口和数据映射、控制边、预算/循环限制）、UI 布局三部分。可以适配 React Flow 的 `nodes/edges/viewport`，但运行时不要依赖 `selected`、`dragging`、像素坐标；`toObject()` 是可视化保存工具，不足以成为跨运行时契约。

### 直接复用与边界

直接复用 React Flow 的拖拽、缩放、选择、连接、重连、minimap、节点工具条、节点尺寸调整、事件与可访问性接口；Schema 参数表单、错误提示、状态/trace、版本迁移以及循环调度属于 harness 的领域 UI/运行层。官方列出免费与 Pro 示例，undo/redo、copy/paste、协同等高级示例标为 Pro，核心库没有自动提供完整领域编辑历史。[官方示例目录](https://reactflow.dev/examples)

美观 UI 不必从基础 div 重做：免费 [React Flow UI](https://reactflow.dev/ui) 提供基于 shadcn/Tailwind 的可复制组件，包括 Base Node、带标签端口、状态指示器、搜索与缩放控件。其文档已更新到 React 19/Tailwind 4，并说明 CSS 导入顺序。完整 [AI Workflow Editor 模板](https://reactflow.dev/ui/templates/ai-workflow-editor) 是 Next.js + AI SDK + Zustand 的 **Pro 模板**；可作为设计参考或后续授权选项，当前不下载、不以它搭建脚手架。

**优点**：匹配用户已选 React/TypeScript；许可宽松；无需重造几何、连接和交互底座；卡片外观可完全定制。**缺点**：不是 Agent runtime；复用画布不免除产品交互工作；复杂 Schema 到端口、组合卡片和运行视图的语义仍需设计。

**结论：Adopt React Flow；Compose 免费 UI 组件；Build 自己的轻量领域适配层。**

## 4. Flowise：确有独立可嵌入编辑器，但已归档

### 已核实入口与契约

- `packages/components/src/Interface.ts`：`INode` 定义 metadata、`inputs`、`output`、`loadMethods`、`init`、`run`；数据大量使用 `any`/`ICommonObject`，表单 metadata 不等于严格运行 Schema。[源码](https://github.com/FlowiseAI/Flowise/blob/9291856d1ea4a4ceea9f8fef8ce14f4f6c81e8eb/packages/components/src/Interface.ts)
- `packages/server/src/NodesPool.ts`：扫描编译节点文件、`require(file)`、实例化 `nodeClass`，构建节点/凭据池，并读取 `DISABLED_NODES`。这是信任本地模块的动态发现机制，不是插件沙箱。[源码](https://github.com/FlowiseAI/Flowise/blob/9291856d1ea4a4ceea9f8fef8ce14f4f6c81e8eb/packages/server/src/NodesPool.ts)
- `packages/server/src/utils/buildAgentflow.ts`：`nodeExecutionQueue`、等待输入节点集合、loop 计数、变量替换及执行数据持久化；Loop 节点输出指定回跳 node ID 和次数上限。[runtime](https://github.com/FlowiseAI/Flowise/blob/9291856d1ea4a4ceea9f8fef8ce14f4f6c81e8eb/packages/server/src/utils/buildAgentflow.ts)、[Loop 节点](https://github.com/FlowiseAI/Flowise/blob/9291856d1ea4a4ceea9f8fef8ce14f4f6c81e8eb/packages/components/nodes/agentflow/Loop/Loop.ts)
- `packages/ui/src/views/canvas/index.jsx` 是历史应用内 canvas；不要误认为它是唯一可用的前端入口。[源码](https://github.com/FlowiseAI/Flowise/blob/9291856d1ea4a4ceea9f8fef8ce14f4f6c81e8eb/packages/ui/src/views/canvas/index.jsx)

**重要修正**：归档前已有 `packages/agentflow`，`src/index.ts` 明确导出 `Agentflow`、Provider、hook、types 和 `validateFlow`，描述为嵌入式 React 编辑组件。不能断言 Flowise 不支持独立嵌入。[公开 API](https://github.com/FlowiseAI/Flowise/blob/9291856d1ea4a4ceea9f8fef8ce14f4f6c81e8eb/packages/agentflow/src/index.ts)

但是这个组件的 `AgentflowProps` **必须提供 `apiBaseUrl`**，节点目录、凭据、工具动态选项等围绕 Flowise API；`flowId` 在该快照仍标记 reserved/not implemented。它提供自定义 header/palette、save callback 和节点执行 badge，并未提供通用任意 kernel adapter。[props](https://github.com/FlowiseAI/Flowise/blob/9291856d1ea4a4ceea9f8fef8ce14f4f6c81e8eb/packages/agentflow/src/core/types/agentflow.ts)

`FlowData` 是 `nodes/edges/viewport`；`FlowNode.data`、`StateUpdate` 的变量字符串等带 Flowise 语义。快照版本 `0.0.0-dev.14`，peer 依赖 React 18、`reactflow ^11.5.0`、MUI 5 和 Emotion。[JSON 类型](https://github.com/FlowiseAI/Flowise/blob/9291856d1ea4a4ceea9f8fef8ce14f4f6c81e8eb/packages/agentflow/src/core/types/flow.ts)、[package.json](https://github.com/FlowiseAI/Flowise/blob/9291856d1ea4a4ceea9f8fef8ce14f4f6c81e8eb/packages/agentflow/package.json)

### 取舍

**优点**：现成节点目录、表单、变量引用、执行状态卡片；TypeScript server，与本项目语言接近。可直接学习节点 metadata → 参数表单/动态端口、循环返回控制数据、节点执行 trace 的组织方式。

**缺点 / 成本判断**：归档后安全和兼容更新需自己承担；嵌入组件仍依赖 Flowise API；迁移到当前 React Flow 12/React 19 不是无成本；runtime 耦合数据库、组织/workspace、chat/history、SSE 等，复制它容易让 tiny kernel 带上平台语义。商业子目录另有许可。

**结论：不 Adopt 为长期底座；仅参考设计。** 如果短期选择内部完整 Flowise 产品，可 Extend 经许可审计的 fork；这意味着主动承担维护者职责，不是推荐的 ramune-harness 路线。

## 5. Langflow：类型组件与组合工作流值得借鉴

### 已核实入口

- 新共享组件与引擎在 `src/lfx/src/lfx/`，而非只在旧 `src/backend/base/langflow/`：`custom/custom_component/component.py`、`inputs/inputs.py`、`io/schema.py`、`components/<category>/`。[组件基类](https://github.com/langflow-ai/langflow/blob/504c02fc47e76087b82b0e7cbe4186e9cdd916d4/src/lfx/src/lfx/custom/custom_component/component.py)、[Schema 转换](https://github.com/langflow-ai/langflow/blob/504c02fc47e76087b82b0e7cbe4186e9cdd916d4/src/lfx/src/lfx/io/schema.py)
- `graph/graph/base.py` 的 `Graph` 负责 `arun`/`astep`、runnable vertices、cycle detection、checkpoint 与条件分支排除。**当前不是只能运行 DAG**，源码存在 `CycleEdge` 和循环管理。[Graph](https://github.com/langflow-ai/langflow/blob/504c02fc47e76087b82b0e7cbe4186e9cdd916d4/src/lfx/src/lfx/graph/graph/base.py)
- `src/frontend/src/types/flow/index.ts`：`FlowType.data` 为 `ReactFlowJsonObject`；genericNode 的 APIClass、inputs/outputs 类型和 handle metadata 属于平台 Schema。[前端 JSON 类型](https://github.com/langflow-ai/langflow/blob/504c02fc47e76087b82b0e7cbe4186e9cdd916d4/src/frontend/src/types/flow/index.ts)
- UI 在 `src/frontend/src/CustomNodes/GenericNode/`、`pages/FlowPage/`、`stores/flowStore.ts`；类型化输出、检查面板、节点状态和异常反馈已拆为组件，但并不是已发布的通用 React 画布包。[GenericNode](https://github.com/langflow-ai/langflow/tree/504c02fc47e76087b82b0e7cbe4186e9cdd916d4/src/frontend/src/CustomNodes/GenericNode)、[FlowPage](https://github.com/langflow-ai/langflow/blob/504c02fc47e76087b82b0e7cbe4186e9cdd916d4/src/frontend/src/pages/FlowPage/index.tsx)

组件声明 `inputs` 与 `outputs`，输出指定执行 method；类型与参数界面协同。官方 custom component 文档说明 Python component 文件目录加载。生产预建目录是 `src/lfx/src/lfx/_assets/component_index.json`，生成入口 `scripts/build_component_index.py`。[custom components](https://docs.langflow.org/components-custom-components)、[索引生成](https://github.com/langflow-ai/langflow/blob/504c02fc47e76087b82b0e7cbe4186e9cdd916d4/scripts/build_component_index.py)

### 循环与组合

`flow_controls/loop.py` 有 Item 与 Done 输出；将 loop body 提取为隔离子图执行，聚合结果，代码说明支持通过反馈边识别嵌套循环体。这是一种**遍历数据集合**的 Loop，不应直接当作 Ralph “验证失败继续修改”的唯一语义。[Loop 源码](https://github.com/langflow-ai/langflow/blob/504c02fc47e76087b82b0e7cbe4186e9cdd916d4/src/lfx/src/lfx/components/flow_controls/loop.py)

`flow_controls/run_flow.py` 调用同项目另一个 flow，动态读取其图并更新暴露参数，也可作为 Agent tool；旧 `SubFlowComponent` 已标 legacy，replacement 指向 RunFlow。可以借鉴“已保存图 → 组合节点接口”，而不是复制已弃用的 SubFlow 路径。[RunFlow](https://github.com/langflow-ai/langflow/blob/504c02fc47e76087b82b0e7cbe4186e9cdd916d4/src/lfx/src/lfx/components/flow_controls/run_flow.py)、[旧 SubFlow](https://github.com/langflow-ai/langflow/blob/504c02fc47e76087b82b0e7cbe4186e9cdd916d4/src/lfx/src/lfx/components/flow_controls/sub_flow.py)

**优点**：MIT；类型化组件、动态参数、inspection 和可组合 flow；LFX 可以从完整平台拆开使用。**缺点 / 推断**：运行契约由 Python/Pydantic、Message/Data/Table 等框架类型控制；前端依赖其 store/API/types；把 genericNode 整套抽为 ramune UI 比直接用 React Flow 增加平台适配工作。Frozen 缓存输出与 enabled/disabled 的旁路并非同一语义。

**结论：Compose 类型节点和组合边界的设计；不复制完整 UI/runtime。** 若必须扩展现成框架，Langflow 是这几个完整可视化平台中相对合理的 Extend 候选，但需接受 Python、既有图格式和组件执行模型。

## 6. Dify：强产品参考；前端复用受许可，运行时已独立抽离

### 当前源码入口

- UI：`web/app/components/workflow/index.tsx`；`types.ts` 定义 React Flow `Node/Edge` 扩展、`BlockEnum`、`ValueSelector = string[]`，以及图的 `nodes/edges/viewport`。输入引用以 node ID 加字段路径表示。[types](https://github.com/langgenius/dify/blob/2b65f0e8930964ce2be9e7054dde5a2cd74ff605/web/app/components/workflow/types.ts)
- `nodes/components.ts` 的 `NodeComponentMap` 显式映射节点类别到 React components；`nodes/index.tsx` 包装 BaseNode。普通 UI node 不是任意第三方插件自动发现；扩展内置类型仍需更新前端映射。Provider/Tool/Agent plugin 是另一层。[注册映射](https://github.com/langgenius/dify/blob/2b65f0e8930964ce2be9e7054dde5a2cd74ff605/web/app/components/workflow/nodes/components.ts)
- `api/services/app_dsl_service.py`：YAML DSL 导入导出，带应用、工作流及 plugin dependency 等平台内容；并非只导出一个通用 nodes/edges JSON。[DSL 服务](https://github.com/langgenius/dify/blob/2b65f0e8930964ce2be9e7054dde5a2cd74ff605/api/services/app_dsl_service.py)
- `api/core/workflow/node_factory.py`：导入 Graphon 与 Dify-local nodes，生产 bootstrap 主动导入模块让 `Node` 子类注册，按 type/version 解析节点。不要继续将旧 `api/core/workflow/graph_engine` 当成当前实际引擎。[factory](https://github.com/langgenius/dify/blob/2b65f0e8930964ce2be9e7054dde5a2cd74ff605/api/core/workflow/node_factory.py)

Loop 是每次沿用状态的渐进修正；Iteration 是处理独立数组项目。Loop 支持退出条件、最大次数和 Exit Loop 节点。对 Coding/Ralph 流程更贴近的是前者，应在 UI 里清楚区分这两种“重复”。[官方 Loop 文档](https://docs.dify.ai/en/cloud/use-dify/nodes/loop)

**优点**：成熟的变量选择、配置面板、单节点测试、执行追踪、循环容器与错误处理产品模式；独立 SDK/API 可作为外部服务调用。**缺点 / 推断**：平台级 workspace/auth/plugin/rag 负担很大；UI `web/` 受到品牌条款，未来多租户另有条件；复制 Dify UI 与 “tiny loop、everything is a node” 不匹配。

**结论：Compose 外部 Dify 服务仅作为可选远程能力；不采用 console 源码作为本项目编辑器。** 可以学习信息组织与错误定位方式，运行语义、UI 实现保持独立。

### Graphon：需要单独列入运行时复用候选

官方独立仓库 [langgenius/graphon](https://github.com/langgenius/graphon) 使用 Apache-2.0。当前公共入口是 `graphon.engine.Engine`、`graphon.graph.Graph/GraphBuilder/NodeFactory`、runtime state/variable pool 与 host integration protocols。[架构说明](https://github.com/langgenius/graphon/blob/0384e3f4958a723ccb135175f6ca3fabfbc932a8/ARCHITECTURE.md)

实际关键目录：`src/graphon/engine/engine.py`、`dispatcher.py`、`scheduler.py`、`nodes/base/node.py`、`nodes/loop/loop_node.py`、`nodes/iteration/iteration_node.py`、`runtime/runtime_state/`。Node 泛型 hydration 和 `__init_subclass__` 注册 node type/version，registry reader 不主动导入扩展，bootstrap 由宿主掌握。[Node 基类](https://github.com/langgenius/graphon/blob/0384e3f4958a723ccb135175f6ca3fabfbc932a8/src/graphon/nodes/base/node.py)

**可直接复用**：已有 Engine、事件流、frame 调度、循环/Iteration、宿主适配协议、pause/resume/snapshot 功能。**代价**：Python 进程与 TS 的契约、IPC/服务部署、0.x API 演进；它已有 workers、dispatcher、frames，比极小本地串行 kernel 多一层机制。**结论：Compose 作为 Python runtime 的备选，不作为当前推荐；重点借鉴“图配置 / 宿主适配 / 执行状态 / 事件呈现”边界。** 单独复用 Graphon 不等于复用了受限制 Dify 前端。

## 7. n8n：动态节点与观测体验可学，整套复用不适合

### 已核实入口

- `packages/workflow/src/interfaces.ts`：`INode` 包含 type/version、position、disabled、retry、credentials、parameters；`INodeTypeDescription` 定义类型化 inputs/outputs 和 properties；`NodeConnectionTypes` 将主流程 `main` 与 `ai_tool/ai_memory/ai_languageModel/...` 分开。[interfaces](https://github.com/n8n-io/n8n/blob/03f7c76acdca8510ad65b49a78578e42819d708a/packages/workflow/src/interfaces.ts)
- JSON 由 `nodes` 和按节点名索引的 `connections` 构成，每个连接包含目的 node、connection type 与 input index；这不同于直接持久化 React Flow edges。运行数据是 item 列表以及多输入/多输出槽位，不是简单共享 state 字典。[同源 interfaces](https://github.com/n8n-io/n8n/blob/03f7c76acdca8510ad65b49a78578e42819d708a/packages/workflow/src/interfaces.ts)
- `packages/cli/src/load-nodes-and-credentials.ts`：DirectoryLoader/PackageDirectoryLoader、known/loaded/type registries、node output schema 查找；`node-types.ts` 解析 node implementation。[加载器](https://github.com/n8n-io/n8n/blob/03f7c76acdca8510ad65b49a78578e42819d708a/packages/cli/src/load-nodes-and-credentials.ts)
- `packages/core/src/execution-engine/workflow-execute.ts`：运行队列、run data、生命周期 hook、取消、部分执行、wait/resume 和数据 readiness；并有 Agent tool 通过非 main connections 执行的特殊处理。[执行入口](https://github.com/n8n-io/n8n/blob/03f7c76acdca8510ad65b49a78578e42819d708a/packages/core/src/execution-engine/workflow-execute.ts)
- 当前 UI：`packages/frontend/editor-ui/src/features/workflows/canvas/components/Canvas.vue` 使用 `@vue-flow/core`，有 context menu、keyboard shortcuts、布局、hover、selection validation、pin data、node groups 等应用依赖；应用入口 `app/views/NodeView.vue`。[Canvas](https://github.com/n8n-io/n8n/blob/03f7c76acdca8510ad65b49a78578e42819d708a/packages/frontend/editor-ui/src/features/workflows/canvas/components/Canvas.vue)

**优点**：现成大量 connector、versioned node descriptions、credentials、执行记录、单节点调试和数据检查；main control/data flow 与 AI capability connections 的区别特别值得参考。**缺点 / 推断**：Vue UI 与 React 目标不匹配；item pairing/expression/credentials 生命周期侵入节点契约；运行平台比 tiny loop 大得多；可视化工作流产品对外复用受商业许可条件影响。

**结论：不 Adopt 编辑器或 core 为本项目底座；Compose 一个用户自己管理的 n8n 实例作为可选外部自动化能力。** 概念层借鉴能力端口和 schema-driven 参数面板。若未来产品要让外部客户配置 n8n 工作流，即使 UI 自己写也需要按当时官方条款取得适当商业授权，不能靠替换前端绕过许可。

## 8. 领域设计与交互要求：从证据推导的建议

以下是本项目设计建议，不是上游已自动提供的能力，也不是本轮已实现或已测试的功能。

### 工作流和插件边界

1. **注册分三层**：领域 catalog（type/version、input/output JSON Schema、配置 schema、能力需求）→ executor registry（实现与允许的能力）→ UI renderer registry（普通卡片、参数表单和必要的特殊视图）。React Flow `nodeTypes` 只负责第三层。默认卡片可以服务大部分 node；高级可视化是可选，不能要求每个插件写完整 UI。
2. **区分控制边、数据映射、能力绑定**：决定哪个节点接下来执行的边，与将上游字段映射到下游输入的规则不是同一件事；Model 使用 Tool/Memory 可以是能力绑定或调用关系，不能误当作“每次都按主流程顺序执行”。n8n 的 main 与 ai_* 区分提供了具体参照。
3. **Schema 是运行约束**：端口 label 和 type badge 不足以证明类型安全。载入、连接、配置、执行输入输出都需要约定验证；插件升级必须保留 type/version 与迁移规则。JSON Schema 描述 JSON 数据；Function、AbortSignal、开放句柄等不可序列化能力通过上下文注入，不塞进工作流文件。
4. **关闭卡片明确语义**：disabled 是跳过、旁路输入、使用缓存，还是禁止运行，必须区别。多输出 router 不可不加规则直接旁路；Check 被关闭也不应静默变为已验证。UI 文案应与运行实际一致。
5. **组合是边界，不只是矩形**：组合节点暴露固定输入输出；保存内部 graph 引用/版本及映射；定义自己的局部 state 与 cancellation/trace parent；进入组合卡片有 breadcrumb，退出后仍能观察子节点错误。禁止失控递归，深度和执行预算属于通用执行政策。
6. **循环可视且有限**：用户可以指定任意合法返回边和分支；UI 标注 loop-back 与 exit；执行层限制最大步数、循环轮次、时间、费用和取消。Ralph 是“修改→Check→Decision→继续/退出”的模板，不能让 Kernel 内建 Ralph/LLM 特殊规则。条件规则采用受限制 DSL/结构化表达式，避免工作流 JSON 包含任意 eval 代码。

### 专业 UI 的最小可审查范围

| 用户任务 | 建议交互 | 可复用底座 / 仍需领域工作 |
| --- | --- | --- |
| 放置和连接节点 | 搜索/键盘添加、拖拽添加、端口 label、允许连接提示、无效原因；输入表单不触发拖拽 | React Flow handles/events + React Flow UI search/labeled handles；Schema compatibility 与文案自定义 |
| 看清图 | 一致卡片层级、有限色彩编码、暗/亮模式、fit view、合理布局、低 zoom 精简详情 | React Flow viewport/themes；布局采用成熟库；信息密度与可读性由产品设计验证 |
| 配置并修正 | 独立 inspector，必填/类型错误精准到字段；dirty/autosave 状态；撤销/重做；复制节点保留配置且生成新 ID | 免费组件与表单库；领域历史/保存与 ID 重映射需提供，Pro 高级示例是可选授权参考 |
| 运行与定位 | run/cancel、当前执行节点、每轮与每次 attempt 区分、耗时；点击节点查看 inputs/outputs/logs/errors，并跳转失败处 | React Flow UI status indicator；事件序列、redaction、结构化数据检视属于 harness |
| 组合与恢复 | 可折叠组合、breadcrumb、外露端口、内部失败冒泡；载入旧文件提示迁移结果 | React Flow sub-flows 是视觉基础；组合契约、trace parent 和迁移需自定 |

### 编辑器与运行时复用总结

| 候选 | 编辑器单独复用 | runtime 单独复用 | 对 ramune 的选择 |
| --- | --- | --- | --- |
| React Flow | 已发布通用 React 库，低耦合 | 不提供 Agent runtime | **Adopt** |
| Flowise Agentflow | 确有组件，但 dev 版本且依赖 Flowise API | TypeScript，却耦合平台且停止维护 | 参考，非推荐长期依赖 |
| Langflow | MIT，但应用 store/API/组件 Schema 耦合 | LFX 可独立使用，Python | 必须完整框架时优先 **Extend** 候选 |
| Dify | 受品牌条款；应用组件，非通用库 | 当前执行部分独立 Graphon | 服务可 **Compose**；不复制 console |
| Graphon | 无图形编辑器 | 独立 Python Apache 引擎，0.x | runtime **Compose** 备选 |
| n8n | Vue + 商业用途许可条件 | TypeScript，但大平台且同样有用途限制 | 外部服务 **Compose** 备选 |

## 9. 待验证点

- 未安装或测量编辑器 bundle、启动时间、节点吞吐、循环恢复正确性、Windows 行为；上文成本判断是源代码结构推断。
- Flowise dev.14 的 npm 分发状态、兼容性与 fork 安全更新未验证；不把它当维护中稳定产品。
- React Flow Pro 完整模板只查了官方描述与访问限制，未获取/检查付费源码，因此不基于其内部调度算法做结论。
- Langflow/LFX、Graphon 的最新发布兼容策略需要在真正确认采用时锁版本并做最小集成验证；当前只建议参考或备选。
- 下一步需求访谈应确认：disabled 行为、组合卡片跨文件复用、任意循环与嵌套循环范围、暂停恢复保证、并发/分支合流、观测数据保存与脱敏。这些答案决定领域层复杂度，不能从画布能力自动推导。
