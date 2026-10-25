# Ramune Harness 项目约定

## 项目背景

- 首版是用户自己的本地开发工具。
- 编程语言为 TypeScript，主要界面采用 React + React Flow。
- 所有文档的标题、说明和结论使用中文；产品名、文件路径、API 标识符、机器读取字段和标签保留原文。
- 2026-10-25 用户已明确授权自主实现、真实测试及 Windows / WSL Linux 双环境部署，进入产品交付阶段。

## 工程技能

### 任务跟踪

任务和规格使用 `.scratch/` 下的本地 Markdown 文件。创建、读取、更新或关闭任务时，先阅读 `docs/agents/issue-tracker.md`。

### 分诊标签

采用五个默认分诊标签。分诊或解释任务状态时，先阅读 `docs/agents/triage-labels.md`。

### 领域文档

采用单上下文布局：根目录 `GLOSSARY.md` 与 `docs/adr/`。探索领域术语或架构决策前，先阅读 `docs/agents/domain.md`。

## 研究与需求

进行架构或依赖选型时，阅读 `docs/adr/0001-hybrid-reuse.md` 与 `docs/research/recommended-stack.md`，并按需追溯证据。混合复用路线已确认，其余研究建议按需求另行确认。

继续需求访谈或制定实现范围时，阅读并更新 `docs/requirements/interview.md`，分别记录已确认事项与待确认问题。
