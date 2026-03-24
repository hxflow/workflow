# Harness Engineering — Claude Code 项目配置

## 项目概述

本项目是 Harness Engineering 需求开发规范的 workflow framework，包含规范文档、Profile 系统和流程命令。
核心理念：工程师不直接写业务代码，而是通过结构化文档 + Agent 执行的方式交付。

## 架构层级

架构因团队而异，通过 Profile 系统定义：
- **后端**: Types → Config → Repo → Service → Runtime
- **前端**: Types → API Services → Stores → Hooks → Components → Pages
- **移动端**: Domain → Data → Presentation → UI（Clean Architecture）

每一层只能导入内层，违反由 CI 自动阻断。

## Profile 系统

所有命令支持 `--profile` 参数指定团队配置：
```
--profile backend           # 服务端
--profile frontend          # 前端
--profile mobile:ios        # 移动端 iOS
--profile mobile:android    # 移动端 Android
--profile mobile:harmony    # 移动端 HarmonyOS
```

Profile 配置位于 `harness-scaffold/profiles/` 目录，包含团队的架构层级、任务拆分规则、黄金原则、审查清单、需求模板和计划模板。

## 工作流命令

### 一键自动化（推荐）

| 命令 | 用途 |
|------|------|
| `/hx-go <feature> [--task <id>] --profile <team>` | **全自动流水线**：Phase 01→08 一条龙，支持从 DevOps 拉取任务到 MR 创建，4 个人工检查点 |
| `/hx-run-all <feature> --profile <team>` | **批量执行**：跳过 01-02，执行所有 pending TASK + 审查 + 门控 |

### 单步命令（手动控制）

| 命令 | 阶段 | 用途 |
|------|------|------|
| `/hx-doc <feature> [--task <id>] --profile <team>` | Phase 01 | 创建需求文档（从 DevOps 拉取任务 + 团队模板） |
| `/hx-plan <feature> --profile <team>` | Phase 02 | 生成执行计划（按团队策略拆分 TASK） |
| `/hx-ctx [--profile <team>]` | Phase 03 | 校验上下文 + Profile 文件完整性 |
| `/hx-run <feature> <task-id> --profile <team>` | Phase 04 | 按 TASK-ID 驱动 Agent 执行 |
| `/hx-review [--profile <team>]` | Phase 05 | 按团队审查清单审查 diff |
| `/hx-gate [--profile <team>]` | Phase 04/06 | 运行团队对应的门控命令 |
| `/hx-fix [--profile <team>]` | Phase 05 | 读取 Review 意见按团队规范修复 |
| `/hx-done <task-id>` | 收尾 | 标记任务完成，更新进度 |
| `/hx-entropy [--profile <team>]` | Phase 07 | 熵扫描（全局 + 团队专项） |
| `/hx-mr <feature> [--project <path>]` | Phase 08 | 创建 GitLab MR + CI 监控 |

## 关键文件

- `harness-scaffold/AGENTS.md` — Agent 上下文索引（≤100 行）
- `harness-scaffold/docs/golden-principles.md` — 全局黄金原则 GP-001~GP-012
- `harness-scaffold/docs/map.md` — 架构全图
- `harness-scaffold/docs/requirement/` — 需求设计文档
- `harness-scaffold/docs/plans/` — 执行计划与进度 JSON
- `harness-scaffold/profiles/` — 团队自定义配置（Profile 系统）

## 执行规则

1. 每个 TASK 独立开会话执行，不在同一会话连续执行多个 TASK
2. 所有代码必须通过团队对应的门控检查
3. 错误使用 AppError 类，禁止裸 throw new Error
4. 禁止 console.log 进入 src/，使用结构化 logger
5. 执行前必须读取 `AGENTS.md` + `golden-principles.md` + 团队 `golden-rules.md`
6. Profile 配置优先级：全局 → 团队 → 平台（移动端额外一层）
7. Git commit 消息格式：`<type>: #<taskId>@<taskName>`，如 `feat: #TS-46474@新增巴士订单订单明细展示&契约对接`
