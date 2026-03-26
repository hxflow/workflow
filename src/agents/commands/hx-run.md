---
name: hx-run
description: Phase 04 · 执行需求
usage: hx-run [<feature-key>] [--task <task-id>] [--profile <name>]
claude: /hx-run
codex: hx-run
---

# Phase 04 · 执行需求

参数: `$ARGUMENTS`（格式: `[<feature-key>] [--task <task-id>] [--profile <name>]`）

## 执行步骤

1. 解析参数：可选 `feature-key`、可选 `--task <task-id>`、`--profile`
2. 确定目标 feature：
   - 若传入 `feature-key`，直接作为当前需求的内部主键使用
   - 若未传入，则优先从当前会话最近一次 `hx-plan` / `hx-doc` 的目标文档自动续接
   - 若仍无法唯一定位目标 feature，则停止并要求用户补充 `feature-key`
3. 解析 Profile：优先 `--profile`，否则读 `.hx/config.yaml` 的 `defaultProfile`
   - 按顺序查找：`.hx/profiles/<name>/` → `~/.hx/profiles/<name>/` → 框架内置 `profiles/<name>/`
   - 处理 `extends:` 继承，合并架构层级与门控配置
4. 解析路径：读取 `.hx/config.yaml`（项目层）和 `~/.hx/config.yaml`（用户层）合并后的 `paths` 字段，以下字段缺失时使用默认值，将 `{feature}` 和 `{taskId}` 替换为实际值：

   | 字段 | 默认值 |
   |------|--------|
   | `paths.requirementDoc` | `docs/requirement/{feature}.md` |
   | `paths.planDoc` | `docs/plans/{feature}.md` |
   | `paths.progressFile` | `docs/plans/{feature}-progress.json` |
   | `paths.taskDoc` | （空，不使用）|

5. 执行内置预检（等价于当前 `feature key` 对应需求的轻量 `hx-ctx`）：
   - `requirementDoc` 必须存在，且至少包含 1 条 AC（验收标准）
   - `planDoc` 必须存在且可读取
   - `progressFile` 必须存在且可解析
   - `progressFile` 中至少存在 1 个任务
   - base profile 和当前 profile 的 `golden-rules.md` 必须存在且非空
   - 当前 profile.yaml 必须可读取，`gate_commands` 中至少有一个非空命令
   - 若任一检查失败，立即停止并报告问题；提示用户必要时单独运行 `hx-ctx [feature-key] --profile <name>` 诊断
6. 读取上下文（按顺序）：
   - base profile 的 `golden-rules.md`
   - profile 的 `golden-rules.md`
   - `requirementDoc`（需求文档）
   - `planDoc`（确定任务顺序和验收标准）
   - `progressFile`（确定待执行任务集合）
   - 若 `taskDoc` 已配置且文件存在，额外读取（作为补充执行上下文）
7. 确定执行范围：
   - 若传入 `--task <task-id>`，仅执行该任务（高级模式，用于调试、重试、断点恢复）
   - 若未传入 `--task`，按 `planDoc` / `progressFile` 中的顺序执行当前 `feature key` 对应需求下所有 `pending` 任务
8. 加载前置 Hook（`run-pre.md`，存在则注入为额外约束）
9. 逐任务执行：
   - 对每个目标任务，按其验收标准、架构层级约束直接执行（编写代码）
   - 每个任务完成后立即更新 `progressFile`：目标任务 `status → done`，写入 `completedAt`
   - 若某个任务失败，立即停止后续任务，保留已完成任务的进度更新
10. 加载后置 Hook（`run-post.md`，存在则执行额外指令）
11. 输出结果：
   - 默认展示本次完成任务数、剩余任务数和下一步建议
   - 若仍有 `pending` 任务，提示重新运行 `hx-run [feature-key] --profile <name>` 继续
   - 若全部任务完成，提示继续运行 `hx-qa`

## 执行约束

- 默认模式一次执行整个 `feature key` 对应需求，下钻到单 task 仅用于高级场景
- 指定 `--task` 时，任务状态不是 `pending` 则拒绝执行，提示当前状态
- 严格遵守 profile 定义的架构层级（只能导入内层）
- 不跨当前 `feature key` 对应需求边界修改代码
- 错误使用 `AppError` 类，禁止裸 `throw new Error`
- 禁止 `console.log` 进入 `src/`，使用结构化 logger

## Hook 路径

- `~/.hx/hooks/run-pre.md` / `.hx/hooks/run-pre.md`
- `~/.hx/hooks/run-post.md` / `.hx/hooks/run-post.md`
- `.hx/config.yaml` 的 `hooks.run.pre` / `hooks.run.post` 列表
