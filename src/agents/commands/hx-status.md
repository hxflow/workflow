---
name: hx-status
description: 查看任务进度
usage: hx-status [<feature-key> | --feature <key>]
claude: /hx-status
codex: hx-status
---

# 查看任务进度

参数: `$ARGUMENTS`（可选: `<feature-key>` 或 `--feature <key>`）

## 执行步骤

1. 解析路径：读取合并后的 `paths.progressFile`（默认 `docs/plans/{feature}-progress.json`），按模板扫描所有进度文件；若指定了 `feature-key` 则只读对应文件
2. 对每个 feature 统计并展示：
   - 总任务数、已完成数、进行中数、待完成数
   - 进度条（`█░` 可视化）
   - 若指定了具体 feature，列出所有任务的 id、名称、状态、completedAt
3. 高亮下一个 `pending` 任务，提示继续运行 `hx-run <feature-key>`；若只想重试单个任务，可额外提示 `hx-run <feature-key> --task <task-id>`
4. 若所有任务已完成，提示运行 `hx-clean`

## 输出格式

**概览（无参数）：**
```
── user-login ──────────────────────────────
   [████████░░]  4/5 完成
   下一个: TASK-BE-05 — 集成测试

── order-flow ──────────────────────────────
   [██████████]  3/3 完成  ✓
```

**详情（指定 feature）：**
```
── user-login ──────────────────────────────
   [████████░░]  4/5 完成

   ✓ TASK-BE-01  Types 定义           2026-03-20
   ✓ TASK-BE-02  Repository 层        2026-03-21
   ✓ TASK-BE-03  Service 层           2026-03-22
   ✓ TASK-BE-04  Controller 层        2026-03-23
   ○ TASK-BE-05  集成测试              pending

   下一步: hx-run user-login --profile base
   仅重试当前任务: hx-run user-login --task TASK-BE-05 --profile base
```
