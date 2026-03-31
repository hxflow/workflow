---
name: hx-ctx
description: Phase 03 · 当前需求执行前预检（可选）
usage: hx-ctx [<feature>]
---

# Phase 03 · 当前需求执行前预检（可选）

参数: `$ARGUMENTS`（格式: `[<feature>]`）

## 执行步骤

1. 确定目标 `feature`。
2. 读取 `.hx/config.yaml`。
3. 检查当前需求执行所需资源：
   - `requirementDoc`
   - `planDoc`
   - `progressFile`
4. 检查固定规则文件：
   - `.hx/rules/golden-rules.md`
   - `.hx/rules/review-checklist.md`
   - `.hx/rules/requirement-template.md`
   - `.hx/rules/plan-template.md`
5. 检查 `gates` 至少存在一个非空命令。
6. 输出预检结果，并指出缺失项或异常项。

## 约束

- 只依赖当前项目内的配置、规则和文档
- 正常主流程优先直接运行 `hx-run`；仅在排查输入问题时单独执行 `hx-ctx`
