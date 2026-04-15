---
name: hx-run
description: Phase 04 · 执行需求
usage: bun src/tools/run.ts <next|validate> <feature> [--plan-task <task-id>]
---

# Phase 04 · 执行需求

## 目标

执行当前 feature 的可运行任务。

## 约束

- `--plan-task <taskId>` 只限制本次目标 task，不改变完整任务图
- 只改动与任务边界相关的内容，不引入无关变更
- 遵守 `rules/golden-rules.md` 中的约束
- `bun src/tools/run.ts next <feature>` 获取下一批可执行任务
- `bun src/tools/run.ts validate <feature>` 确认最终状态
- `bun src/tools/progress.ts start <feature> <taskId>` 标记任务开始
- `bun src/tools/progress.ts done <feature> <taskId>` 标记任务完成
- `bun src/tools/progress.ts fail <feature> <taskId>` 标记任务失败
