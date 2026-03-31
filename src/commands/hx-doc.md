---
name: hx-doc
description: Phase 01 · 获取需求并创建需求文档
usage: hx-doc
hooks:
  - pre
  - post
---

# Phase 01 · 获取需求并创建需求文档

参数: `$ARGUMENTS`（无参数）

## 执行步骤

1. 判断需求来源：
   - 若当前输入已包含完整需求上下文，则按当前输入整理需求
   - 若已连接外部需求来源，则读取来源详情并转成统一需求事实
2. 基于需求详情整理需求文档内容，并生成项目内唯一的 `feature` 标识。
3. 读取 `.hx/config.yaml` 中的 `paths.requirementDoc`。
   - 缺失时默认使用 `docs/requirement/{feature}.md`
4. 读取 `rules/golden-rules.md` 和 `rules/requirement-template.md`。
5. 基于模板创建 `requirementDoc`。
6. 输出创建结果，并提示下一步运行 `hx-plan`。

## 约束

- 只读取当前项目规则与配置
- 缺少需求来源时停止，不能凭空补齐关键约束
- `feature` 仅作为项目内的稳定需求标识，用于串联需求、计划和进度文件
- `feature` 只在 `hx-doc` 首次创建需求时生成
- `feature` 优先使用中文，基于需求详情总结生成，不转英文、不转拼音
- `feature` 只保留核心业务主题，长度尽量短，建议控制在 2 到 8 个中文字符
- `feature` 不包含 `taskId`、日期、人员名等无关信息
- 若与当前项目已有 `feature` 冲突，则追加 `-2`、`-3` 等后缀
