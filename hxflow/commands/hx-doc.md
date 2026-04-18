# 获取需求并创建需求文档

## 执行步骤

1. 执行 `bun scripts/tools/doc.ts context <feature>`，读取当前需求来源、已注册模板和现有需求文档事实。
2. 生成或续接 `docs/requirement/{feature}.md`，再执行 `bun scripts/tools/doc.ts validate <feature>` 校验头部格式。
3. 根据校验结果修正头部和正文，输出前新开一个子 agent 评审并按结论修正。

## 约束

- 头部字段格式、顺序和验证规则由 `scripts/lib/feature-header.ts` 定义，以脚本返回的事实为准
- 先复用后生成，已有头部字段（displayName、sourceId、sourceFingerprint、Type）优先沿用脚本返回的 `existingHeader`
- 只修正文档头部和正文，不扩展额外契约层
