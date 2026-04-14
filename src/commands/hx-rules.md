---
name: hx-rules
description: 查看或更新项目规则事实
usage: bun src/tools/rules.ts [update]
---

# 项目规则事实

## 目标

- 查看当前项目规则概况，或刷新规则自动区和缺失配置。

## 何时使用

- 适用场景：想检查 `.hx/config.yaml` 和规则文件是否齐全，或需要刷新自动生成内容。
- 不适用场景：首次接入项目时优先用 `bun src/tools/init.ts`；正常主流程中不需要频繁运行。

## 输入

- 命令参数：`$ARGUMENTS`
- 必选参数：无
- 可选参数：`update`
- 默认值：未传 `update` 时进入只读查看模式
- 依赖输入：`.hx/config.yaml`、`.hx/rules/*.md`、`src/templates/config.yaml`、`src/templates/rules/`、当前项目真实信号

## 执行步骤

1. 默认模式下，读取 `.hx/config.yaml` 和固定规则文件，输出 `paths.*`、`gates.*` 以及 hooks / commands / pipelines 目录概况。
2. `update` 模式下，重新扫描项目真实信号，读取配置模板和规则模板，归纳 `projectFacts`。
3. 仅更新规则文件的 `hx:auto` 区，并按模板补齐 `.hx/config.yaml` 的缺失字段。
4. 缺失文件按固定骨架创建；旧文件不含双区块时，把原始正文迁入 `hx:manual` 区。
5. 输出更新摘要、默认值使用情况和人工区保留情况。

## 成功结果

- 默认模式下输出当前规则概况。
- `update` 模式下输出自动区刷新结果和保留情况。

## 失败边界

- 配置不可读。
- 模板缺失，或项目事实无法安全归纳。

## 下一步

- 发现缺失项时运行 `bun src/tools/rules.ts update`；更新完成后重新检查规则结果。

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
