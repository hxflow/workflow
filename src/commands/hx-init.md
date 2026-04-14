---
name: hx-init
description: 初始化项目规则事实
usage: bun src/tools/init.ts
protected: true
---

# 初始化项目规则事实

## 目标

- 基于当前仓库真实信号生成 `.hx/config.yaml`、规则文件和项目骨架。

## 何时使用

- 适用场景：首次接入 HXFlow，或项目骨架缺失、需要重新补全时。
- 不适用场景：项目已经完成初始化且骨架完整时，不需要再次执行；只是刷新规则自动区时，优先用 `bun src/tools/rules.ts update`。

## 输入

- 命令参数：`$ARGUMENTS`
- 必选参数：无
- 可选参数：无
- 默认值：无
- 依赖输入：当前项目目录结构、依赖与构建文件、现有 `.hx/*`、`CLAUDE.md` / `AGENTS.md`、`src/templates/` 骨架文件

## 执行步骤

1. 确定项目根：优先使用已存在的 `.hx/config.yaml`，否则向上查找 `.git`。
2. 扫描项目真实信号，包括依赖文件、构建入口、源码目录、文档目录、现有 `.hx/*` 以及 `CLAUDE.md` / `AGENTS.md` 标记块。
3. 先判断项目是否已经完成初始化：`.hx/config.yaml`、固定规则文件、项目级骨架和 Agent 标记块均存在且结构完整时，直接停止写入并提示无需重复执行。
4. 仅当初始化骨架缺失、损坏或关键文件不存在时，基于 `src/templates/config.yaml` 生成或补全 `.hx/config.yaml`。
5. 仅当固定规则文件缺失或骨架不完整时，基于 `src/templates/rules/*` 生成或补齐固定规则文件。
6. 仅当项目级骨架或 Agent 标记块缺失时，补齐 `.hx/commands/`、`.hx/hooks/`、`.hx/pipelines/` 等骨架，并更新 `CLAUDE.md` / `AGENTS.md` 标记块。

## 成功结果

- 首次初始化或缺失补齐时，生成或补全项目配置、规则文件和基础骨架。
- 已完成初始化且骨架完整时，明确返回“当前项目无需再次执行 `bun src/tools/init.ts`”。

## 失败边界

- 无法判定项目根。
- 模板缺失，或关键配置无法安全生成。

## 下一步

- 首次初始化完成后运行 `bun src/tools/doc.ts` 或 `bun src/tools/rules.ts`。
- 若只是更新自动区或补齐缺失配置，优先运行 `bun src/tools/rules.ts update`。

## 约束

- 只根据真实文件、目录和命令定义归纳项目事实
- 不虚构技术栈、目录、脚本或架构结论
- 已有配置和人工内容优先保留，只补全缺失部分
- 配置和规则内容以模板文件为准，不在本命令正文内维护骨架
- 已完成初始化且骨架完整时，不得重复改写项目级初始化产物
- 只初始化项目骨架，不负责后续执行、校验或修复
