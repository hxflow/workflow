---
name: hx-plan
description: Phase 02 · 生成执行计划
usage: bun src/tools/plan.ts <context|validate> <feature>
---

# Phase 02 · 生成执行计划

## 目标

把 `requirementDoc` 转成可执行的 `planDoc` 和 `progressFile`。

## 约束

- feature 值固定，来自需求文档头部，不允许重算
- planDoc 每个 task 只写目标、修改范围、实施要点、验收标准
- 粒度：每个 task 独立可实现、可验证
- `bun src/tools/plan.ts context <feature>` 获取需求内容、planTemplate、规则
- `bun src/tools/plan.ts validate <feature>` 校验 planDoc 和 progressFile
