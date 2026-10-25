# 分诊标签

工程技能使用以下五种分诊角色，对应本地任务文件的 `Status:` 值。

| 分诊角色 | 本地状态值 | 含义 |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | 等待维护者评估 |
| `needs-info` | `needs-info` | 等待补充信息 |
| `ready-for-agent` | `ready-for-agent` | 规格充分，可由智能体自主实现 |
| `ready-for-human` | `ready-for-human` | 需要人工实现 |
| `wontfix` | `wontfix` | 决定不处理 |

技能提及某种分诊角色时，使用表中的本地状态值。标签字符串保留原文，以维持技能兼容性。

日后修改标签词汇时，更新本表的本地状态值列。探索任务的 `open`、`claimed`、`resolved` 生命周期另见 `issue-tracker.md`。
