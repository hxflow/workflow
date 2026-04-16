# 创建 Merge Request

## 执行步骤

1. 直接基于当前上下文、需求文档、计划/进度和 git 变更生成 MR 标题与描述。
2. 自行核对未完成 task、目标分支和变更摘要，不依赖额外事实脚本。
3. 需要归档时执行 `bun scripts/tools/mr.ts archive <feature>`。

## 下一步

- `hx status <feature>`

## 约束

- 不允许在 MR 阶段生成或重算需求、计划、任务
- 未完成 task 存在时直接失败
- 归档统一写入 `docs/archive/{feature}/`
