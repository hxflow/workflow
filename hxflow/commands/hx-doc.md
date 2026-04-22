# 获取需求并创建需求文档

## 执行步骤

1. 执行 `bun scripts/tools/doc.ts context <feature>`，读取需求来源、模板和现有文档事实。
2. 在 workspace 多项目目录中扫描可能受影响的服务，确认协调层、执行服务和关联服务。
3. 生成或续接 `docs/requirement/{feature}.md`，再执行 `bun scripts/tools/doc.ts validate <feature>`。
4. 校验失败时只修正文档本身。

## 下一步

- `hx plan <feature>`

## 约束

- 先复用后生成，已有 `displayName`、`sourceId`、`sourceFingerprint`、`Type` 优先沿用
- workspace 根目录只维护协调文档，具体改动在 task 中落到各服务
- workspace 的 docs、runtime 和 rules 优先级最高，子项目只覆盖执行目录、源码路径和质量门
- 单项目目录不做额外服务归属判断
- 只维护需求文档，不扩展额外契约
