# 任务跟踪：本地 Markdown

项目的任务和规格保存在 `.scratch/` 下。GitHub 远程仓库用于版本管理，任务跟踪仍采用本地文件。

## 文件约定

- 每个功能一个目录：`.scratch/<feature-slug>/`。
- 功能规格：`.scratch/<feature-slug>/spec.md`。
- 实现任务：`.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 开始编号，每个任务单独一个文件。
- 文件顶部使用 `Status:` 字段记录分诊状态，取值见 `triage-labels.md`。
- 评论和讨论追加到文件底部的 `## 评论` 小节。
- 文件标题与正文使用中文；路径占位符、编号及机器读取字段保留原文。

## 发布到任务跟踪系统

在对应功能目录中创建文件，按需创建目录。发布实现任务时遵循独立任务文件的路径约定。

## 读取相关任务

读取用户引用的本地文件。用户可以提供文件路径，或功能范围内的任务编号；同号任务必须结合所属功能定位。

## 探索任务流程

`wayfinder` 技能使用一份探索地图和若干子任务文件。

- 地图：`.scratch/<effort>/map.md`，包含笔记、已有决策和待探索问题。
- 子任务：`.scratch/<effort>/issues/NN-<slug>.md`，从 `01` 编号，正文记录待回答的问题。
- `Type:` 字段取值为 `research`、`prototype`、`grilling` 或 `task`。
- 探索生命周期使用 `Status: open`、`claimed` 或 `resolved`，与普通任务的分诊标签分开。
- 依赖使用 `Blocked by: NN, NN` 字段；所有依赖均为 `resolved` 时，任务解除阻塞。
- 选取任务时，在未领取、未阻塞且开放的任务中按编号选择第一个。
- 开始工作前，将状态保存为 `claimed`。
- 完成后，在 `## 答案` 小节追加结果，保存为 `resolved`，再将摘要和链接追加到地图的已有决策中。
