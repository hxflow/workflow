---
name: hx-go
description: 全自动流水线 · 从需求到交付
usage: hx-go [<feature>] [--from <step-id>] [--pipeline <name>]
---

# 全自动流水线 · 从需求到交付

## 目标

自动检测流水线当前阶段，并从当前可执行步骤继续推进主链路。

## 使用方式

```bash
hx go <feature> [--from <step>]
```

`hx go` 会自动完成以下工作：
- 检测 `doc` / `plan` / `run` 的完成状态（基于文件系统）
- 确定恢复起点（或使用 `--from` 强制指定）
- 从 `plan / run / check / mr` 顺序调用对应编排脚本
- 汇总每个步骤的结构化结果

**流水线顺序:** `doc → plan → run → check → mr`

`check` 和 `mr` 总是重新执行（无持久化完成标记）。

## 约束

- 自定义 pipeline（`--pipeline`）暂未支持，仅支持 `default`
- 自动恢复不得跳过最早未完成 step
- `--from <step>` 必须是有效 step 名称
- `doc` 当前仍是 agent contract；若起点落在 `doc`，返回阻断并提示手动执行 `hx doc`
