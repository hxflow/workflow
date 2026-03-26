---
name: hx-ctx
description: Phase 03 · 当前需求执行前预检（可选）
usage: hx-ctx [<feature-key>] [--profile <name>]
claude: /hx-ctx
codex: hx-ctx
---

# Phase 03 · 当前需求执行前预检（可选）

参数: `$ARGUMENTS`（格式: `[<feature-key>] [--profile <name>]`）

## 执行步骤

1. 解析参数：可选 `feature-key`、可选 `--profile <name>`
2. 确定目标 feature：
   - 若传入 `feature-key`，直接作为当前需求的内部主键使用
   - 若未传入，则优先从当前会话最近一次 `hx-doc` / `hx-plan` 的目标文档自动续接
   - 若仍无法唯一定位目标 feature，则停止并要求用户补充 `feature-key`
3. 解析 Profile（可选）：优先 `--profile`，否则读 `.hx/config.yaml` 的 `defaultProfile`
4. 解析路径：读取 `.hx/config.yaml`（项目层）和 `~/.hx/config.yaml`（用户层）合并后的 `paths` 字段：

   | 字段 | 默认值 |
   |------|--------|
   | `paths.requirementDoc` | `docs/requirement/{feature}.md` |
   | `paths.planDoc` | `docs/plans/{feature}.md` |
   | `paths.progressFile` | `docs/plans/{feature}-progress.json` |

5. 检查当前需求的最小执行上下文：
   - `requirementDoc` 必须存在，且至少包含 1 条 AC（验收标准）
   - `planDoc` 必须存在且可读取
   - `progressFile` 必须存在且可解析
   - `progressFile` 中至少存在 1 个任务
   - 若所有任务均非 `pending`，明确提示当前需求已无待执行任务
6. 检查当前 profile 运行所需资源：
   - base profile 的 `golden-rules.md` 必须存在且非空
   - 当前 profile 的 `golden-rules.md` 必须存在且非空
   - 当前 profile.yaml 必须可读取
   - `gate_commands` 中至少有一个非空命令
   - 若存在 `extends:`，其继承链也必须完整
7. 输出预检结果：
   - 成功时只说明“当前需求可执行”
   - 失败时列出缺失文档、不可解析文件或 profile 问题

## 输出格式

```
── 执行前预检 ──────────────────────────────
  ✓ 需求文档: 已就绪
  ✓ 执行计划: 已就绪
  ✓ 进度文件: 已就绪
  ✓ Profile: <name> 可加载
  ✓ 当前需求: 可以开始执行
```

任何检查失败时，列出具体问题并停止。正常主流程优先直接运行 `hx-run`；仅在排查输入问题时单独执行 `hx-ctx`。
