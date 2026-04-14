---
name: hx-run
description: Phase 04 · 执行需求
usage: hx-run <next|validate> <feature> [--plan-task <task-id>]
hooks:
  - pre
  - post
---

# Phase 04 · 执行需求

## 目标

执行当前 feature 的可运行任务。

## 何时使用

- 适用场景：执行计划已就绪，需要逐批实现任务。
- 不适用场景：计划文档尚未创建，应先运行 `hx plan`。

## 输入

- 脚本是事实工具，AI 调用子命令获取任务调度事实后自行实现
- 子命令：
  - `hx run next <feature> [--plan-task <taskId>]`
  - `hx run validate <feature>`
- 必选参数：`<feature>`
- 可选参数：`--plan-task <taskId>`（限定本次目标 task）

## 执行步骤

1. 调用 `hx run next <feature>` 获取下一批可执行任务，返回 JSON：
   ```json
   {
     "ok": true,
     "completed": false,
     "feature": "<feature>",
     "progressFile": "<路径>",
     "restored": true|false,
     "mode": "recover|run",
     "parallel": true|false,
     "tasks": [{"id":"...","name":"...","status":"...","dependsOn":[]}],
     "tasksContext": [{"taskId":"...","planSnippet":"...","requirementSnippet":"...","dependencyOutputs":[]}],
     "goldenRules": "<规则内容>|null"
   }
   ```
   - `completed: true` 表示所有任务已完成，无需继续。
   - `mode: "recover"` 表示存在中断任务需恢复。
2. AI 根据 `tasksContext` 和 `goldenRules` 逐个实现任务：读取上下文 → 实现代码/文档变更 → 调用 `hx progress start` / `hx progress done` / `hx progress fail` 更新状态。
3. 单批完成后再次调用 `hx run next <feature>` 获取下一批，循环直到 `completed: true`。
4. 调用 `hx run validate <feature>` 确认最终状态，返回 JSON：
   ```json
   {
     "ok": true,
     "feature": "<feature>",
     "progressFile": "<路径>",
     "allDone": true|false,
     "done": 5,
     "total": 5,
     "completedAt": "<时间戳>|null",
     "tasks": [{"id":"...","name":"...","status":"done"}]
   }
   ```

## 成功结果

- `validate` 返回 `allDone: true`，所有任务完成。

## 失败边界

- progressFile 不存在：先运行 `hx plan <feature>`。
- 校验失败：检查 progressFile 结构后重试。
- 任务阻断（blocked）：输出阻断原因，等待人工介入后再重试。

## 下一步

- 继续运行 `hx check` 进行质量检查。

## 约束

- 脚本只提供事实（任务调度、上下文），AI 负责实现和状态更新
- `--plan-task <taskId>` 只限制本次目标 task，不改变完整任务图
- 只改动与任务边界相关的内容，不引入无关变更
- 遵守 `rules/golden-rules.md` 中的约束
