---
name: hx-go
description: 全自动流水线 · 从需求到交付
usage: hx-go <next|state> <feature> [--from <step-id>]
---

# 全自动流水线 · 从需求到交付

## 目标

自动检测流水线当前阶段，返回下一步应执行的命令，AI 自行调用对应命令推进主链路。

## 何时使用

- 适用场景：需要从当前阶段自动推进完整交付流水线。
- 不适用场景：只需执行单个阶段时，直接调用对应命令。

## 输入

- 脚本是事实工具，不再 spawn 子进程；AI 读取下一步后自行调用对应命令
- 子命令：
  - `hx go next <feature> [--from <step>]`
  - `hx go state <feature>`
- 必选参数：`<feature>`
- 可选参数：`--from <step>`（强制指定起点）

## 执行步骤

1. 调用 `hx go next <feature>` 获取下一步，返回 JSON：
   ```json
   {
     "ok": true,
     "feature": "<feature>",
     "nextStep": "plan",
     "command": "hx plan",
     "state": [{"id":"doc","name":"需求文档","status":"done"},{"id":"plan","name":"执行计划","status":"pending"}]
   }
   ```
2. AI 根据 `command` 调用对应命令（如 `hx plan context <feature>`）。
3. 完成当前步骤后，再次调用 `hx go next <feature>` 获取下一步，循环直到流水线完成。
4. 调用 `hx go state <feature>` 查看完整状态，返回 JSON：
   ```json
   {
     "ok": true,
     "feature": "<feature>",
     "allDone": true|false,
     "nextStep": "check"|null,
     "steps": [{"id":"doc","name":"...","command":"hx doc","status":"done|pending|skipped"}]
   }
   ```

**流水线顺序:** `doc` → `plan` → `run` → `check` → `mr`

`check` 和 `mr` 总是重新执行（无持久化完成标记）。

## 成功结果

- `state` 返回 `allDone: true`，流水线全部完成。

## 失败边界

- `--from <step>` 指定了无效 step 名称。
- `doc` 阶段需要手动执行 `hx doc`，`next` 返回阻断提示。

## 下一步

- 流水线完成后无后续步骤。

## 约束

- 脚本只提供事实（流水线状态、下一步命令），AI 负责逐步调用
- 不再 spawn 子进程执行步骤
- 自动恢复不得跳过最早未完成 step
- `--from <step>` 必须是有效 step 名称
