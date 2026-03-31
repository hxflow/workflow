---
name: hx-rules
description: 查看或更新项目规则事实
usage: hx-rules [update]
---

# 项目规则事实

参数: `$ARGUMENTS`（格式: `[update]`）

## 执行步骤

1. 若未传入 `update`：
   - 读取 `.hx/config.yaml`
   - 检查 `.hx/rules/golden-rules.md`、`.hx/rules/review-checklist.md`、`.hx/rules/requirement-template.md`、`.hx/rules/plan-template.md`
   - 输出 `paths.*`、`gates.*`、hooks / skills / pipelines 目录概况
   - 若存在缺失项，提示运行 `hx-rules update`
2. 若传入 `update`：
   - 重新扫描项目真实信号，包括依赖文件、源码目录、文档目录、`.hx/*` 和质量门脚本
   - 读取 `src/templates/config.yaml`
   - 读取 `src/templates/rules/` 下的规则模板
   - 归纳 `projectFacts`
   - 仅更新各个规则文件的 `hx:auto` 区
   - 缺失文件时按固定骨架新建
   - 旧文件不含双区块时，保留原始正文到 `hx:manual` 区
   - `.hx/config.yaml` 只按配置模板补全缺失字段
   - 输出更新摘要、默认值使用情况和人工区保留情况

## 约束

- 默认模式只读不写
- `update` 只刷新自动区与缺失配置
- `hx:manual` 区内容永久保留
- 不做复杂 merge，只做固定骨架更新
- `.hx/config.yaml` 的缺失字段必须按 `src/templates/config.yaml` 补齐
- `.hx/config.yaml` 不再维护 `hooks.*`
- 规则骨架必须来自 `src/templates/rules/`
- 由命令直接完成扫描、判断和写入
- 允许“不确定”，不允许虚构项目事实
