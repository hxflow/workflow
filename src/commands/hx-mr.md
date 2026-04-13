---
name: hx-mr
description: Phase 08 · 创建 Merge Request
usage: hx-mr [<feature>] [--project <group/repo>] [--target <branch>]
hooks:
  - pre
  - post
---

# Phase 08 · 创建 Merge Request

## 目标

基于需求文档、进度状态和 git 事实生成 MR 标题与描述。

## 使用方式

```bash
hx mr <feature> [--target <branch>] [--project <group/repo>]
```

`hx mr` 会自动完成以下工作，并输出精确的生成指令：
- 定位 requirementDoc / progressFile（活跃或归档）
- 解析 feature 头部（固化解析）
- 收集 git log 和 diff --stat 事实
- 检测 target branch，构造最小 MR 上下文供 AI 使用
- 生成成功后自动归档 feature 产物

## AI 职责：生成 MR 内容

AI 只负责生成：
- **MR 标题**（单行，清晰描述变更）
- **MR 描述**（Markdown）：需求背景、变更说明、AC 验收清单、任务完成情况、测试说明

## 约束

- feature 只读取已有值，不允许在 MR 阶段生成或重算
- 归档路径固定：`docs/archive/{feature}/`，不允许自定义
- 未完成 task 存在时直接失败，不调用 AI
- 归档动作由确定性代码执行，不由 AI 手工调用
