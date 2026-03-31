# 项目规则生成与运行时约束

> 状态：已实现
> 日期：2026-03-30
> 类型：实现对齐文档

---

## 概述

当前仓库已经将规则能力收敛为“初始化分析 + 运行时静态读取”模型。

运行时只读取项目内事实：

- `.hx/config.yaml`
- `.hx/rules/*.md`
- `.hx/hooks/`
- `.hx/commands/`
- `.hx/pipelines/`

初始化与更新由 workflow skill 契约驱动：

- `src/commands/hx-init.md`
- `src/commands/hx-rules.md`

---

## 当前实现

### 1. 项目扫描

`hx-init` 与 `hx-rules update` 的当前约束是由 Agent 直接分析项目真实信号，至少应读取：

- `package.json`
- 锁文件：`pnpm-lock.yaml`、`yarn.lock`、`bun.lock`、`package-lock.json`
- `tsconfig.json`
- 顶层目录与常见源码目录
- 现有 `.hx/config.yaml`

基于扫描结果推导：

- 包管理器
- 主要源码目录
- 文档路径模板
- lint / test / type / build 质量门
- 技术栈摘要

### 2. 配置生成

`.hx/config.yaml` 的目标结构如下：

```yaml
schemaVersion: 2

paths:
  src: src
  requirementDoc: docs/requirement/{feature}.md
  planDoc: docs/plans/{feature}.md
  progressFile: docs/plans/{feature}-progress.json

gates:
  lint: null
  test: null
  type: null
  build: null

hooks:
  doc:
    pre: []
    post: []
  plan:
    pre: []
    post: []
  run:
    pre: []
    post: []
  review:
    pre: []
    post: []
  fix:
    pre: []
    post: []
  clean:
    pre: []
    post: []
  mr:
    pre: []
    post: []
```

约束：

- 只补全缺失字段，不覆盖已有值
- 不写长文本规则正文
- 不做复杂配置合并

### 3. 规则文件生成

固定规则文件为：

- `.hx/rules/golden-rules.md`
- `.hx/rules/review-checklist.md`
- `.hx/rules/requirement-template.md`
- `.hx/rules/plan-template.md`

每个文件都使用双区块结构：

```md
<!-- hx:auto:start -->
... 自动生成内容 ...
<!-- hx:auto:end -->

<!-- hx:manual:start -->
... 人工维护内容 ...
<!-- hx:manual:end -->
```

更新规则：

- 已有双区块时，只重写 `hx:auto` 区
- 无双区块时，保留原始正文并迁入 `hx:manual` 区
- 人工区永久保留

### 4. 初始化附带骨架

`hx-init` 除了生成配置和规则，还应补齐：

- `.hx/commands/README.md`
- `.hx/commands/hx-your-command.md.example`
- `.hx/hooks/README.md`
- `.hx/hooks/run-pre.md.example`
- `.hx/hooks/run-post.md.example`
- `.hx/pipelines/default.yaml`

并在项目根更新：

- `CLAUDE.md`
- `AGENTS.md`

注入 `hx:guide` 标记块，写入当前项目的路径模板说明。

### 5. 运行时边界

当前所有 `hx-*` workflow skill 契约都已按以下边界收口：

- 运行时只依赖项目内配置、规则和文档
- `hx-go` 只负责按 pipeline 调度命令
- `hx-run` 只更新进度状态，不扩写计划内容
- `hx-review` 以实际 diff 和项目规则为准
- `hx-qa` 只执行 `config.gates`

---

## 实际文件映射

当前仓库中与该能力直接相关的文件为：

```text
bin/hx.js
src/scripts/hx-setup.js
src/scripts/lib/config-utils.js
src/scripts/lib/install-utils.js
src/scripts/lib/resolve-context.js
src/commands/hx-init.md
src/commands/hx-rules.md
src/pipelines/default.yaml
```

---

## 当前限制

以下能力当前未实现：

- 自定义 task id 格式
- 关闭 progress 文件的纯 taskDoc 模式
- 更细粒度的项目结构识别
- 规则片段的外部共享与编译注入
- 面向规则生成的独立 registry / store / install 流程

---

## 结论

当前项目已经完成的不是“概念迁移”，而是一套稳定的项目规则生成机制：

- 用 `hx-init` 建立项目规则骨架
- 用 `hx-rules update` 刷新自动区
- 用 `.hx/config.yaml` 承载硬变量
- 用 `.hx/rules/*.md` 承载解释性规则
- 用 `.hx/hooks/`、`.hx/commands/`、`.hx/pipelines/` 作为项目级扩展点

后续文档与实现都应以这套结构为准，不再引入额外的运行时配置模型，也不要把项目分析固化为新的扫描脚本链。
