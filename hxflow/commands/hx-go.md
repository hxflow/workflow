# 全自动流水线

## 执行步骤

1. 执行 `hx-go next <feature>`，读取当前 step 的 `toolScript`、`preHooks`、`postHooks`。
2. 按顺序执行：读取 `preHooks` → 运行 `toolScript` → 读取 `postHooks`。
3. 遇到 `checkpoint.message` 时启动子 agent 评审，按结论继续或重跑当前 step。
4. 重复直到 `allDone` 或明确阻断。

## 约束

- 不得跳过最早未完成的 step
- 只按脚本返回的下一步推进；`--from <step>` 仅用于显式重启
- `go` 自身的 hooks 由路由层（SKILL.md）处理；step 级别的 hooks 由 `go.ts next` 返回
