---
name: hx-status
description: 查看任务进度
usage: hx-status [<feature> | --feature <name>]
protected: true
---

# 查看任务进度

参数: `$ARGUMENTS`（可选: `<feature>` 或 `--feature <name>`）

## 执行步骤

1. 读取 `paths.progressFile`，默认 `docs/plans/{feature}-progress.json`。
2. 扫描进度文件；若指定了 `feature`，则只读取对应文件。
3. 展示：
   - 总任务数、已完成数、待完成数
   - 指定 feature 时列出所有任务的 id、名称、状态、completedAt
4. 高亮下一个 `pending` 任务，提示继续运行 `hx-run <feature>`。
5. 若所有任务已完成，提示运行 `hx-clean`。

## 约束

- 下一步提示直接给出可执行命令
