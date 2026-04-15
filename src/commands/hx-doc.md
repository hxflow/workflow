---
name: hx-doc
description: Phase 01 · 获取需求并创建需求文档
usage: bun src/tools/doc.ts <context|validate> <feature> [--type <feature|bugfix>]
---

# Phase 01 · 获取需求并创建需求文档

## 目标

把当前需求整理成 `requirementDoc`，为后续主链路提供唯一的 feature 事实源。

## 何时使用

- 开始处理新需求或新缺陷，需要把外部详情沉淀为项目内文档。
- 已有 feature 继续计划或实现时用 `bun src/tools/go.ts`、`bun src/tools/plan.ts`、`bun src/tools/run.ts`。

## 输入

- 命令参数：`bun src/tools/doc.ts <context|validate> <feature>`
- 必选参数：`<feature>`
- 可选参数：`--type <feature|bugfix>`、`--source-file <path>`、`--force`
- 默认值：`--type` 默认 `feature`
- 依赖输入：`.hx/config.yaml`、`rules/golden-rules.md`、`rules/requirement-template.md`、`rules/bugfix-requirement-template.md`、`src/contracts/feature-contract.md`

## 执行步骤

1. `bun src/tools/doc.ts context <feature>` — 获取模板、规则、已有头部。
2. 结合会话需求上下文，按模板和 feature contract 生成或续接 `requirementDoc`（路径 `docs/requirement/{feature}.md`）。先复用已有 `feature`，仅在无法复用时首次生成 `feature`。
3. 头部固定写入 `Feature`、`Display Name`、`Source ID`、`Source Fingerprint`、`Type` 五个字段。
4. 新开一个子 agent 评审完整性与头部格式，主 agent 根据评审结论修正后再写入。
5. `bun src/tools/doc.ts validate <feature>` — 校验头部合规。不通过则根据 `errors` 修正重试。

## 成功结果

- `validate` 返回 `ok: true`，`requirementDoc` 头部合规，`feature` 已确定。

## 失败边界

- 需求来源不足，无法整理完整需求。
- `feature` 无法按 contract 复用或生成。
- 模板或规则缺失，`validate` 返回 `errors` 且无法修正。

## 下一步

- `bun src/tools/plan.ts` 或 `bun src/tools/go.ts` 走完整主路径。

## 约束

- 缺少需求来源时停止，不凭空补齐关键约束
- `displayName` 只用于展示，不参与路径与主链路定位
- 头部必须包含 `Type` 字段（`feature` 或 `bugfix`）
- 生成后必须新开一个子 agent 评审一次，主 agent 必须根据子 agent 的评审结论修正后再输出
