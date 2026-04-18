---
name: hx
description: "Harness Workflow — 需求到交付的全自动流水线框架。当用户说 /hx、hx doc、hx plan、hx run、hx go 等触发词时使用。支持需求获取、计划生成、任务执行、质量检查、MR 创建的完整工作流。"
compatibility: "Prefers bun runtime; falls back to Node.js via npx tsx"
metadata:
  generator: hxflow
  version: "4.0.0"
---

# Harness Workflow

## 路由

根据 `$ARGUMENTS` 的第一个词匹配命令。匹配后先执行 `bun scripts/lib/hook.ts resolve <command>`；若无 bun 则执行 `npx tsx scripts/lib/hook.ts resolve <command>`。命令命中后先应用全局约束，再读取对应命令文件执行（剩余参数原样透传）；若返回了 `preHooks`，先读取这些 hook 文件：

| 命令 | 文件 | 说明 |
|------|------|------|
| doc | [commands/hx-doc.md](commands/hx-doc.md) | 获取需求并创建需求文档 |
| plan | [commands/hx-plan.md](commands/hx-plan.md) | 生成执行计划 |
| run | [commands/hx-run.md](commands/hx-run.md) | 执行需求 |
| check | [commands/hx-check.md](commands/hx-check.md) | 质量检查 |
| mr | [commands/hx-mr.md](commands/hx-mr.md) | 创建 Merge Request |
| go | [commands/hx-go.md](commands/hx-go.md) | 全自动流水线 |
| init | [commands/hx-init.md](commands/hx-init.md) | 初始化项目 |
| status | [commands/hx-status.md](commands/hx-status.md) | 查看任务进度 |

无参数时默认执行 `go`。未匹配到命令时提示可用命令列表。

## 典型流程

`init` → `doc` → `plan` → `run` → `check` → `mr`

## 全局约束

- 执行 `scripts/tools/*.ts` 或 `scripts/lib/*.ts` 时统一优先使用 `bun`；无 bun 时改用 `npx tsx`
- 进入任一命令前先应用该约束，不在单个 `hx-*.md` 内重复展开
