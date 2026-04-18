# 全自动流水线 · 从需求到交付

## 执行步骤

1. 执行 `bun scripts/tools/go.ts next <feature>` 或 `bun scripts/tools/go.ts state <feature>`，读取流水线下一步、完整状态和 `preHooks`。
2. 先读取 `preHooks`，再按返回的 `toolScript` 路由到对应脚本。
3. 遇到 `checkpoint.message` 时新开一个子 agent 评审，并按结论继续或重跑当前 step。
4. 重复直到流水线完成、被阻塞或显式停止。

## 约束

- 流水线步骤定义、状态解析和下一步计算由 `scripts/lib/pipeline-runner.ts` 实现
- 流水线配置从 `.hx/config.yaml` 读取，默认使用 `default` 流水线
- 不得跳过最早未完成 step
- 下一步、完整状态和 `preHooks` 统一以脚本返回事实为准
- `--from <step>` 必须是脚本验证过的有效 step 名称
