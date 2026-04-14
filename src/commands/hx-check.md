---
name: hx-check
description: 核心检查入口
usage: bun src/tools/check.ts [<feature>] [--scope <review|qa|clean|facts|all>]
hooks:
  - pre
  - post
---

# 核心检查入口

## 目标

实现完成后，执行审查、质量门和工程卫生扫描。

## 何时使用

- 适用场景：任务实现完成后，执行质量检查和代码审查。
- 不适用场景：需要修复已知错误时，使用 `bun src/tools/fix.ts`。

## 输入

- 脚本是事实工具，执行确定性检查并返回结构化结果，AI 负责语义审查
- 子命令：
  - `bun src/tools/check.ts [<feature>] [--scope <review|qa|clean|facts|all>]`
- 可选参数：`<feature>`、`--scope`（默认 `all`）
- scope 说明：
  - `facts`：只返回确定性事实（gates 配置、diff、规则路径），不触发 AI 审查
  - `qa`：执行质量门命令（lint/build/type/test），只看 exit code
  - `review`：构造审查上下文，标记 `needsAiReview: true` 供 AI 分析
  - `clean`：构造卫生扫描上下文，标记 `needsAiReview: true` 供 AI 分析
  - `all`：执行 qa + review + clean

## 执行步骤

1. `--scope facts` 返回纯事实 JSON：
   ```json
   {
     "ok": true,
     "feature": "<feature>|null",
     "scope": "facts",
     "gates": {"test":"npm run hx:test"},
     "branchCheck": {"ok":true,"branch":"feat/xxx","reason":null},
     "diffStat": "<diff统计>",
     "changedFiles": ["src/foo.ts"],
     "reviewChecklist": "<路径>|null",
     "goldenRules": "<路径>|null"
   }
   ```
2. `--scope all` 执行完整检查，返回 JSON：
   ```json
   {
     "ok": true|false,
     "feature": "<feature>|null",
     "scope": "all",
     "qa": {"enabled":true,"ok":true,"summary":"...","reason":null,"gates":[],"branchCheck":{}},
     "review": {"enabled":true,"ok":true,"needsAiReview":true,"context":{...},"summary":null},
     "clean": {"enabled":true,"ok":true,"needsAiReview":true,"context":{...},"summary":null}
   }
   ```
   - `needsAiReview: true` 表示该 scope 的 `context` 需要 AI 进行语义分析。
   - qa 失败时 pipeline 阻塞，review/clean 只提供上下文不阻塞。
3. AI 根据 `review.context` 对照 review-checklist.md 执行审查。
4. AI 根据 `clean.context` 扫描调试代码、dead code、文档一致性。

## 成功结果

- 返回 `ok: true`，所有 gate 通过且无需 AI 审查（或 AI 审查无 blocker）。

## 失败边界

- qa gate 失败，返回 `ok: false` 并附带失败原因。
- review/clean 的 `needsAiReview: true` 需 AI 进一步分析。

## 下一步

- 全部通过后继续运行 `bun src/tools/mr.ts`。
- gate 失败时运行 `bun src/tools/fix.ts` 修复后重试。

## 约束

- 脚本执行确定性检查（gates、diff 收集），AI 负责语义审查
- qa 只看 exit code，不看命令输出文本
- clean 只做扫描和报告，不修改任何文件
- review / clean 不直接执行修复
- 存在 blocker 或 gate 失败时，运行 `bun src/tools/fix.ts` 或人工修复后重试
