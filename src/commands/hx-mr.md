---
name: hx-mr
description: Phase 08 · 创建 Merge Request
usage: bun src/tools/mr.ts <context|archive> <feature> [--project <group/repo>] [--target <branch>]
hooks:
  - pre
  - post
---

# Phase 08 · 创建 Merge Request

## 目标

基于需求文档、进度状态和 git 事实生成 MR 标题与描述。

## 何时使用

- 适用场景：所有任务已完成，准备提交 Merge Request。
- 不适用场景：任务未全部完成，应先运行 `bun src/tools/run.ts`。

## 输入

- 脚本是事实工具，AI 调用子命令获取 MR 上下文后自行生成内容
- 子命令：
  - `bun src/tools/mr.ts context <feature> [--target <branch>] [--project <group/repo>]`
  - `bun src/tools/mr.ts archive <feature>`
- 必选参数：`<feature>`
- 可选参数：`--target <branch>`、`--project <group/repo>`

## 执行步骤

1. 调用 `bun src/tools/mr.ts context <feature>` 获取事实，返回 JSON：
   ```json
   {
     "ok": true,
     "feature": "<feature>",
     "displayName": "<展示名>",
     "sourceId": "<来源ID>",
     "sourceFingerprint": "<指纹>",
     "project": "<group/repo>|null",
     "allDone": true|false,
     "pendingIds": [],
     "requirementDoc": "<路径>",
     "planDoc": "<路径>",
     "progressFile": "<路径>",
     "requirementSummary": "<需求摘要>",
     "progress": {"doneCount":5,"totalCount":5,"tasks":[{"id":"...","name":"...","output":"..."}]},
     "git": {"currentBranch":"...","targetBranch":"...","log":"...","diffStat":"..."}
   }
   ```
   - `allDone: false` 且 `pendingIds` 非空时，直接停止，不生成 MR。
2. AI 根据 `requirementSummary`、`progress`、`git` 生成 MR 标题和描述。
3. 调用 `bun src/tools/mr.ts archive <feature>` 归档 feature 产物，返回 JSON：
   ```json
   {
     "ok": true,
     "feature": "<feature>",
     "performed": true|false,
     "archived": ["<归档文件路径>"],
     "reason": "已归档"
   }
   ```

## 成功结果

- MR 标题和描述已生成，feature 产物已归档。

## 失败边界

- `context` 返回 `allDone: false`，存在未完成任务。
- 需求文档或 progressFile 不存在。

## 下一步

- 提交 MR 到代码托管平台。

## 约束

- 脚本只提供事实（进度、git、需求摘要），AI 负责生成 MR 内容
- feature 只读取已有值，不允许在 MR 阶段生成或重算
- 归档路径固定：`docs/archive/{feature}/`，不允许自定义
- 未完成 task 存在时直接失败，不调用 AI
- 归档由 `bun src/tools/mr.ts archive` 执行，AI 不手工操作文件
