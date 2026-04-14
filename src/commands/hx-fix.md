---
name: hx-fix
description: Phase 05 · 修复错误
usage: hx-fix context [<feature>] [--log <text>] [--file <path>]
hooks:
  - pre
  - post
---

# Phase 05 · 修复错误

## 目标

- 根据明确的错误上下文直接修复问题，并补上最小验证。

## 何时使用

- 适用场景：已经拿到检查结论、错误日志或失败文件，需要快速修复并验证。
- 不适用场景：还没有明确错误上下文时，先跑 `hx-check` 收集问题。

## 输入

- 命令参数：脚本是事实工具，AI 调用子命令获取错误上下文后自行修复
- 子命令：
  - `hx fix context [<feature>] [--log <text>] [--file <path>]`
- 必选参数：无
- 可选参数：`--log <text>`、`--file <path>`、`<feature>`
- 默认值：未传 `--log` 和 `--file` 时，自动运行 `test` gate 并截取失败输出
- 依赖输入：错误日志、失败文件路径或自动执行的 `test` gate 输出、`rules/golden-rules.md`

## 执行步骤

1. 调用 `hx fix context` 获取错误事实，返回 JSON：
   ```json
   {
     "ok": true,
     "feature": "<feature>|null",
     "errorSource": "file|log|gate",
     "errorLog": "<错误日志内容>",
     "goldenRules": "<规则内容>|null",
     "changedFiles": ["src/foo.ts","src/bar.ts"],
     "verifyCommand": "<test gate 命令>|null"
   }
   ```
   - `ok: false` 时返回 `reason` 说明原因（如无错误上下文、test gate 当前通过）。
   - `errorSource` 说明错误来源：`file`（`--file`）、`log`（`--log`）、`gate`（自动执行 test gate）。
2. AI 根据 `errorLog`、`changedFiles`、`goldenRules` 定位相关源文件并直接修复。
3. 运行 `hx check` 验证修复结果，并补一个能复现该问题的回归测试。

## 成功结果

- 修复摘要、受影响文件和回归验证结果。

## 失败边界

- `context` 返回 `ok: false`，错误上下文不足。
- 修复后 `hx check` 仍未通过。

## 下一步

- 修复成功后继续运行 `hx check` 或后续交付流程。

## 约束

- 脚本只提供事实（错误日志、变更文件、规则），AI 负责推理和修复
- 不修改已有函数签名（参数与返回类型）
- 不修改现有测试的期望值（测试是行为契约）
- 修复后补充一个能复现此 Bug 的回归测试
