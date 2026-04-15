---
name: hx-fix
description: Phase 05 · 修复错误
usage: bun src/tools/fix.ts context [<feature>] [--log <text>] [--file <path>]
---

# Phase 05 · 修复错误

## 目标

根据明确的错误上下文直接修复问题，并补最小验证。

## 何时使用

- 已有检查结论、错误日志或失败文件，需要快速修复并验证。
- 无明确错误上下文时先跑 `bun src/tools/check.ts` 收集问题。

## 输入

- 命令参数：`bun src/tools/fix.ts context [<feature>] [--log <text>] [--file <path>]`
- 必选参数：无
- 可选参数：`--log <text>`、`--file <path>`、`<feature>`
- 默认值：未传 `--log` 和 `--file` 时自动运行 `test` gate 截取失败输出
- 依赖输入：错误日志、失败文件路径、`rules/golden-rules.md`

## 执行步骤

1. `bun src/tools/fix.ts context` — 获取错误上下文（errorLog、changedFiles、goldenRules）。
2. 根据错误上下文定位相关源文件并修复。
3. `bun src/tools/check.ts` 验证修复结果，补一个能复现该问题的回归测试。

## 成功结果

- 修复完成，`bun src/tools/check.ts` 通过。

## 失败边界

- `context` 返回 `ok: false`，错误上下文不足。
- 修复后 `bun src/tools/check.ts` 仍未通过。

## 下一步

- `bun src/tools/check.ts` 或后续交付流程。

## 约束

- 不修改已有函数签名
- 不修改现有测试的期望值（测试是行为契约）
- 修复后补充一个能复现此 Bug 的回归测试
