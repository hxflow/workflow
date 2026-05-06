---
name: hx
description: "Harness Workflow — 需求到交付的全自动流水线框架。当用户说 /hx、hx doc、hx plan、hx run、hx go 等触发词时使用。支持需求获取、计划生成、任务执行、质量检查、MR 创建的完整工作流。"
compatibility: "Requires Bun, or Node.js with npx tsx fallback"
metadata:
  generator: hxflow
  version: "4.0.0"
---

# Harness Workflow

## 路由

根据 `$ARGUMENTS` 的第一个词匹配命令，先执行 `bun scripts/lib/hook.ts resolve <command> --cwd <用户工作目录>` 获取 hooks，再按顺序执行：**preHooks → 命令文件 → postHooks**（剩余参数原样透传）。

| 命令 | 文件 | 说明 |
|------|------|------|
| doc | [commands/hx-doc.md](commands/hx-doc.md) | 获取需求并创建需求文档 |
| plan | [commands/hx-plan.md](commands/hx-plan.md) | 生成执行计划 |
| run | [commands/hx-run.md](commands/hx-run.md) | 执行需求 |
| review | [commands/hx-review.md](commands/hx-review.md) | 质量评审 |
| mr | [commands/hx-mr.md](commands/hx-mr.md) | 创建 Merge Request |
| go | [commands/hx-go.md](commands/hx-go.md) | 全自动流水线 |
| init | [commands/hx-init.md](commands/hx-init.md) | 初始化项目 |
| status | [commands/hx-status.md](commands/hx-status.md) | 查看任务进度 |
| reset | [commands/hx-reset.md](commands/hx-reset.md) | 重置需求或计划产物 |

无参数时默认执行 `go`。未匹配到命令时提示可用命令列表。

## 全局规则

- `bun scripts/...` 为运行时脚本入口；**必须从本 SKILL.md 所在目录执行，并通过 `--cwd <用户工作目录>` 传入用户原始工作目录**；未安装 bun 时全局改用 `npx tsx scripts/...`
- hook 解析、脚本路由和运行时回退只在这里定义，各命令文件不重复
- 命令文件只保留 AI 仍可能做错的语义边界，不重复脚本已固化的事实
- 先想清楚再执行：有前提假设就显式写出；存在多种合理解释时，不要静默选一种
- 简单优先：只做完成当前目标所需的最小动作，不预埋额外扩展、抽象或配置
- 外科手术式改动：只改和当前目标直接相关的内容，不顺手重写相邻逻辑
- 目标可验证：步骤和输出要可检查，避免笼统表述

## 典型流程

`init` → `doc` → `plan` → `run` → `review` → `mr`
