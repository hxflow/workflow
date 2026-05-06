# 执行需求

## 执行步骤

1. 执行 `bun scripts/tools/run.ts next <feature>`，读取当前批次任务。
2. 实现当前批次任务：
   - 脚本按依赖图计算批次，返回 `parallel: true` 时并行实现批次内所有 task，`parallel: false` 时顺序实现
   - 每个 task 以 `tasksContext[].execution.root` 为工作目录执行，质量门命令使用 `execution.gates`
3. 按 `tasksContext[].doneCriteria` 校验完成证据：任务契约满足、验证命令通过、变更范围可解释。
4. 满足后通过 `bun scripts/lib/progress.ts done <progressFile> <taskId> --output <summary>` 回写；否则通过 `bun scripts/lib/progress.ts fail ...` 保持阻断或失败状态。
5. 继续读取下一批并执行，重复直到 plan 中所有 task 全部完成。

## 下一步

- `hx review <feature>`

## 约束

- 不得中途等待确认，除非脚本返回 `blocked` 或任务显式标记需人工介入
- 阻断时向用户说明原因并等待输入
- 只处理脚本返回的 task、依赖和状态
- done 必须来自 doneCriteria 证据，不接受自我声明
