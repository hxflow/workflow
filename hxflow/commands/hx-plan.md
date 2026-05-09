# 生成执行计划

## 执行步骤

1. 执行 `hx-plan context <feature>`，读取需求文档、计划模板和进度文件。
2. 生成或续接 `planDoc`，让运行时初始化或校验 `progressFile`。

## 下一步

- `hx run <feature>`

## 约束

- 已确认任务不重算
- 每个 task 保持独立可实现、可验证
