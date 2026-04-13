---
name: hx-run
description: Phase 04 · 执行需求
usage: hx-run [<feature>] [--plan-task <task-id>]
hooks:
  - pre
  - post
---

# Phase 04 · 执行需求

## 目标

执行当前 feature 的可运行任务。

## 使用方式

```bash
hx run <feature> [--plan-task <task-id>]
```

`hx run` 会自动完成以下工作：
- 定位并校验 progressFile
- 计算当前批次（恢复中断 / 执行新任务 / 全部完成）
- 对可执行 task 依次执行 `hx progress start` / AI 实现 / `hx progress done` 或 `hx progress fail`
- 输出本次执行摘要与下一步建议

## AI 职责

`hx run` 只把真正需要 AI 的部分交给 AI：

1. 读取当前 task 的最小上下文
2. 实现代码、文档或配置变更
3. 返回执行结果摘要

**实现质量标准：**
- 只改动与任务边界相关的内容，不引入无关变更
- 遵守 `rules/golden-rules.md` 中的约束
- 不直接修改 `progressFile`

## 故障处理

- progressFile 不存在：先运行 `hx plan <feature>`
- 校验失败：检查 progressFile 结构后重试
- 任务阻断（blocked）：输出阻断原因，等待人工介入后再重试

## 约束

- `--plan-task <task-id>` 只限制本次目标 task，不改变完整任务图
- 调度、状态写回、完成判定全部通过确定性代码完成
- AI 只负责 task 实现与结果返回，不自行调用 `hx progress`
- 提供给 AI 的上下文应收敛到当前 task、依赖输出、requirement 摘要与 plan 片段
