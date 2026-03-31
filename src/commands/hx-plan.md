---
name: hx-plan
description: Phase 02 · 生成执行计划
usage: hx-plan [<feature>]
hooks:
  - pre
  - post
---

# Phase 02 · 生成执行计划

参数: `$ARGUMENTS`（格式: `[<feature>]`）

## 执行步骤

1. 解析参数并确定目标 `feature`。
2. 读取 `.hx/config.yaml` 中的：
   - `paths.requirementDoc`
   - `paths.planDoc`
   - `paths.progressFile`
   - 缺失时默认分别使用 `docs/requirement/{feature}.md`、`docs/plans/{feature}.md`、`docs/plans/{feature}-progress.json`
3. 读取 `rules/golden-rules.md` 和 `rules/plan-template.md`。
4. 从需求文档提取输入事实、验收标准和约束。
5. 写入 `planDoc`。
6. 按固定进度文件结构写入 `progressFile`。

## 约束

- 不覆盖已存在的计划文件（提示用户确认）
- 每个 TASK 必须包含目标、修改范围、实施要点、验收标准、验证方式
- `progressFile` 只描述执行状态和执行时间
- 默认提示下一步 `hx-run`
- 已有需求文档中的 `feature` 只允许续接，不允许在本阶段重算
