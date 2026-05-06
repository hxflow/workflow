# 质量评审入口

## 执行步骤

1. 执行 `bun scripts/tools/review.ts [<feature>] [--scope <scope>]`，读取评审结果。
2. 根据返回的 `scope` 和 `needsAiReview` 决定只报告问题，或只判断是否通过。
3. 未通过时停止，输出结论和问题。

## 约束

- `clean` / `review` 只报告问题，不直接修改
- `qa` 只按 gate 结果决定是否继续
