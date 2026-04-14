---
name: hx-doc
description: Phase 01 · 获取需求并创建需求文档
usage: bun src/tools/doc.ts <context|validate> <feature> [--type <feature|bugfix>]
hooks:
  - pre
  - post
---

# Phase 01 · 获取需求并创建需求文档

## 目标

- 把当前需求整理成稳定的 `requirementDoc`，并为后续主链路提供唯一的 feature 事实源。

## 何时使用

- 适用场景：开始处理一个新需求或新缺陷，或需要把外部详情沉淀为项目内文档。
- 不适用场景：只是继续已有 feature 的计划或实现时，优先用 `bun src/tools/go.ts`、`bun src/tools/plan.ts`、`bun src/tools/run.ts`。

## 输入

- 命令参数：脚本是事实工具，AI 调用子命令获取确定性事实后自行推理和写入
- 子命令：
  - `bun src/tools/doc.ts context <feature> [--type feature|bugfix] [--source-file <path>] [--force]`
  - `bun src/tools/doc.ts validate <feature> [--type feature|bugfix]`
- 必选参数：`<feature>`
- 可选参数：`--type <feature|bugfix>`（默认 `feature`）、`--source-file <path>`、`--force`
- 默认值：`--type` 默认为 `feature`
- 依赖输入：`.hx/config.yaml`、`rules/golden-rules.md`、`rules/requirement-template.md`、`rules/bugfix-requirement-template.md`、`src/contracts/feature-contract.md`

## 执行步骤

1. 调用 `bun src/tools/doc.ts context <feature>` 获取事实，返回 JSON：
   ```json
   {
     "ok": true,
     "feature": "<feature>",
     "docType": "feature|bugfix",
     "requirementDoc": "<路径>",
     "docExists": true|false,
     "overwrite": true|false,
     "templateContent": "<模板内容>",
     "goldenRules": "<规则内容>",
     "featureContract": "<契约内容>",
     "sourceContent": "<外部来源内容>|null",
     "existingHeader": {"Feature":"...","Type":"..."} | null,
     "requiredHeaderFields": ["Feature","Display Name","Source ID","Source Fingerprint","Type"]
   }
   ```
2. AI 根据返回的模板、规则和已有头部，结合会话中的需求上下文，生成或续接 `requirementDoc`。
3. 按 feature contract 先复用已有 `feature`，仅在无法复用时首次生成 `feature`；缺省路径为 `docs/requirement/{feature}.md`。
4. 头部固定写入 `Feature`、`Display Name`、`Source ID`、`Source Fingerprint`、`Type` 五个字段。
5. 新开一个子 agent 评审 `requirementDoc` 的完整性、可执行性和头部格式；主 agent 必须根据子 agent 的评审结论修正后再写入。
6. 调用 `bun src/tools/doc.ts validate <feature>` 校验头部合规，返回 JSON：
   ```json
   {
     "ok": true|false,
     "feature": "<feature>",
     "docType": "feature|bugfix",
     "requirementDoc": "<路径>",
     "exists": true|false,
     "headerFields": {"Feature":"...","Type":"..."},
     "errors": []
   }
   ```
7. 校验不通过则根据 `errors` 修正后重试。

## 成功结果

- `validate` 返回 `ok: true`，`requirementDoc` 头部合规。
- 明确当前 `feature`，并在需要时附带 `displayName`。

## 失败边界

- 需求来源不足，无法整理出完整需求事实。
- `feature` 无法按 contract 复用或生成。
- 模板、规则缺失，或 `validate` 返回 `errors` 且无法修正。

## 下一步

- 正常情况下继续运行 `bun src/tools/plan.ts`；若想走整条主路径，也可以直接回到 `bun src/tools/go.ts`。

## 约束

- 脚本只提供事实（模板、规则、已有头部），AI 负责推理和文档生成
- 只读取当前项目规则与配置
- 缺少需求来源时停止，不能凭空补齐关键约束
- `displayName` 只用于展示，不参与路径与主链路定位
- 头部必须包含 `Type` 字段（`feature` 或 `bugfix`），用于后续命令识别文档类型
- 文档生成完成后，必须新开子 agent 评审一次，主 agent 必须根据子 agent 的评审结论修正后再输出
