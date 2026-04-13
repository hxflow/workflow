---
name: hx-plan
description: Phase 02 · 生成执行计划
usage: hx-plan [<feature>]
hooks:
  - pre
  - post
---

# Phase 02 · 生成执行计划

## 目标

把 `requirementDoc` 转成可执行的 `planDoc` 和 `progressFile`。

## 使用方式

```bash
hx plan <feature>
```

`hx plan` 会自动完成以下工作，并输出精确的生成指令：
- 定位需求文档，解析 feature 头部（固化解析）
- 根据 `Type` 字段选择计划模板（feature / bugfix）
- 构造最小计划上下文并调用 AI
- 由代码写入 `planDoc / progressFile` 并执行 schema 校验

## AI 职责：生成 planDoc 和任务拆分结果

AI 只负责返回：
1. `planDoc` 文本
2. task 列表：`id / name / dependsOn / parallelizable`

**planDoc 质量标准：**
- 每个 task 只写目标、修改范围、实施要点、验收标准
- 不写依赖关系和并行标记
- 粒度：每个 task 独立可实现、可验证

## 约束

- feature 值固定，来自需求文档头部，不允许重算
- `progressFile` 由确定性代码按固定 schema 生成，不由 AI 直接写入
- progressFile 必须通过 `hx progress validate` 才算完成
