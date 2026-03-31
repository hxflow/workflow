---
name: hx-run
description: Phase 04 · 执行需求
usage: hx-run [<feature>] [--plan-task <task-id>]
hooks:
  - pre
  - post
---

# Phase 04 · 执行需求

参数: `$ARGUMENTS`（格式: `[<feature>] [--plan-task <task-id>]`）

## 执行步骤

1. 解析参数并确定目标 `feature`。
2. 读取 `.hx/config.yaml` 的：
   - `paths.requirementDoc`
   - `paths.planDoc`
   - `paths.progressFile`
   - `gates.*`
   - `paths.*` 缺失时默认分别使用 `docs/requirement/{feature}.md`、`docs/plans/{feature}.md`、`docs/plans/{feature}-progress.json`
3. 执行内置预检：
   - `requirementDoc` 存在
   - `planDoc` 存在
   - `progressFile` 可解析
   - `rules/golden-rules.md` 存在
   - 至少存在一个非空 gate
4. 读取执行上下文：
   - `rules/golden-rules.md`
   - `requirementDoc`
   - `planDoc`
   - `progressFile`
5. 若传入 `--plan-task`，仅执行该计划任务；否则执行所有 `pending` 任务。
6. 每个任务完成后更新 `progressFile`。
7. 全部完成后提示继续运行 `hx-qa`。

## 约束

- 执行时只依赖当前项目内的配置、规则和文档
- 默认执行整个 feature；`--plan-task` 仅用于调试和恢复单个计划任务
- `progressFile` 只更新状态字段，不扩写计划内容
- 若仍有 `pending` 任务，提示继续运行 `hx-run`
- 执行阶段只读取现有 `feature`，不生成、不改写、不重算
