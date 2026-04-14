---
name: hx-plan
description: Phase 02 · 生成执行计划
usage: bun src/tools/plan.ts <context|validate> <feature>
hooks:
  - pre
  - post
---

# Phase 02 · 生成执行计划

## 目标

把 `requirementDoc` 转成可执行的 `planDoc` 和 `progressFile`。

## 何时使用

- 适用场景：需求文档已就绪，需要拆分为可执行的任务计划。
- 不适用场景：需求文档尚未创建，应先运行 `bun src/tools/doc.ts`。

## 输入

- 脚本是事实工具，AI 调用子命令获取确定性事实后自行推理和写入
- 子命令：
  - `bun src/tools/plan.ts context <feature>`
  - `bun src/tools/plan.ts validate <feature>`
- 必选参数：`<feature>`
- 依赖输入：需求文档、计划模板、`rules/golden-rules.md`、progressFile schema

## 执行步骤

1. 调用 `bun src/tools/plan.ts context <feature>` 获取事实，返回 JSON：
   ```json
   {
     "ok": true,
     "feature": "<feature>",
     "displayName": "<展示名>",
     "sourceId": "<来源ID>",
     "docType": "feature|bugfix",
     "planDoc": "<计划文档路径>",
     "progressFile": "<进度文件路径>",
     "planExists": true|false,
     "progressExists": true|false,
     "requirementContent": "<需求文档全文>",
     "planTemplate": "<计划模板内容>",
     "goldenRules": "<规则内容>|null",
     "progressTemplate": "<进度模板内容>|null",
     "progressSchemaPath": "<schema路径>"
   }
   ```
2. AI 根据 `requirementContent`、`planTemplate`、`goldenRules` 生成 `planDoc` 和任务拆分结果。
3. AI 写入 `planDoc` 和 `progressFile`（按 progressTemplate 的 schema 格式）。
4. 调用 `bun src/tools/plan.ts validate <feature>` 校验产物，返回 JSON：
   ```json
   {
     "ok": true|false,
     "feature": "<feature>",
     "planDoc": "<路径>",
     "progressFile": "<路径>",
     "planExists": true|false,
     "progressExists": true|false,
     "errors": [],
     "tasks": [{"id":"...","name":"...","status":"...","dependsOn":[],"parallelizable":false}]
   }
   ```
5. 校验不通过则根据 `errors` 修正后重试。

## 成功结果

- `validate` 返回 `ok: true`，`planDoc` 和 `progressFile` 均存在且合规。

## 失败边界

- 需求文档不存在，`context` 返回错误。
- `progressFile` schema 校验失败。

## 下一步

- 继续运行 `bun src/tools/run.ts` 执行任务。

## 约束

- 脚本只提供事实（需求内容、模板、规则），AI 负责推理和文档生成
- feature 值固定，来自需求文档头部，不允许重算
- planDoc 每个 task 只写目标、修改范围、实施要点、验收标准
- 粒度：每个 task 独立可实现、可验证
