---
name: hx-mr
description: Phase 08 · 创建 Merge Request
usage: bun src/tools/mr.ts <context|archive> <feature> [--project <group/repo>] [--target <branch>]
---

# Phase 08 · 创建 Merge Request

## 目标

基于需求文档、进度状态和 git 事实生成 MR 标题与描述。

## 约束

- feature 只读取已有值，不允许在 MR 阶段生成或重算
- 未完成 task 存在时直接失败
- 归档路径固定 `docs/archive/{feature}/`，不允许自定义
- `bun src/tools/mr.ts context <feature>` 获取 MR 上下文
- `bun src/tools/mr.ts archive <feature>` 归档 feature 产物
