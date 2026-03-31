---
name: hx-go
description: 全自动流水线 · 从需求到交付
usage: hx-go [<feature>] [--from <step-id>] [--pipeline <name>]
---

# 全自动流水线 · 从需求到交付

参数: `$ARGUMENTS`（格式: `[<feature>] [--from <step-id>] [--pipeline <name>]`）

## 执行步骤

1. 按 `src/pipelines/README.md` 的公共规则查找流水线定义。
2. 解析参数：
   - `<feature>`
   - `--from <step-id>`
   - `--pipeline <name>`
3. 按 `src/commands/resolution.md` 的公共规则解析每一步对应的命令。
4. 按 pipeline 顺序调度子命令。
5. 若未显式传入 `<feature>`，优先从最近一次需求上下文自动续接。

## 约束

- `hx-go` 自身不读取规则正文
- `hx-go` 只负责调度子命令与遵守 pipeline 定义
