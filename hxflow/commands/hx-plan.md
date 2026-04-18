# 生成执行计划

## 执行步骤

1. 执行 `bun scripts/tools/plan.ts context <feature>`，读取需求文档、计划模板和进度文件。
2. 生成或续接 `planDoc`，让运行时初始化或校验 `progressFile`。

## 约束

- 任务结构和进度文件格式由 `scripts/lib/types.ts` 和 `scripts/lib/progress-context.ts` 定义
- 只根据脚本返回的任务事实组织计划，不自行扩展字段或状态
- 已有任务存在时不重算已确认内容，每个 task 保持独立可实现、可验证
