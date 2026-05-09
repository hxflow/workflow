# 质量评审入口

## 执行步骤

1. 执行 `hx-review [<feature>]`，读取评审结果。
2. 若 `qa.needsAiReview` 为真，根据 `qa.context` 分析项目并配置 gates，再重新执行。
3. 若 `review.needsAiReview` 为真，根据 `review.context` 做代码评审，报告问题。
4. 未通过时停止，输出结论和问题。

## 约束

- review 只报告问题，不直接修改
- qa 必须先有已配置 gate，再按 gate 结果决定是否继续
