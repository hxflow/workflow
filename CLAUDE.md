# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

`@hxflow/cli` 是一个 Profile 驱动的 AI 工程工作流框架，作为 npm 全局包发布，供 Claude Code 和 Codex 使用。核心设计：工程师通过结构化文档 + Agent 执行的方式交付需求，而非直接写业务代码。

## 常用命令

```bash
# 测试
pnpm vitest run                         # 运行所有测试
pnpm vitest run tests/unit/profile-utils.test.js  # 运行单个测试文件
pnpm vitest                             # 监听模式

# 打包（无构建步骤，直接使用源码）
npm run pack:dry-run                    # 预览打包内容
npm run release:pack                    # 生成 .tgz

# 本地调试
node bin/hx.js setup                    # 直接执行 CLI 入口
node bin/hx.js doctor
```

> 项目无 lint 脚本，但 `eslint.config.js` 已配置；无 build 步骤，源码即发布文件（`type: "module"`，ESM）。

## 架构

### 三层覆盖体系

框架层 < 用户层 < 项目层，优先级由低到高：

```
<frameworkRoot>/src/           # 框架内置（随 npm 包发布）
~/.hx/                         # 用户全局自定义（跨项目共享）
<project>/.hx/                 # 项目专属覆盖（最高优先级）
```

三层均包含相同的子目录结构：`commands/`、`profiles/`、`pipelines/`、`config.yaml`。

### 核心模块

- **`bin/hx.js`** — CLI 入口，只路由 `setup/upgrade/uninstall/doctor/version` 五个内置命令，`hx-*` 工作流命令是给 Agent（Claude/Codex）调用的，不通过 `hx` 直接执行
- **`src/scripts/`** — 内置命令的实现脚本（`hx-setup.js`, `hx-upgrade.js`, `hx-uninstall.js`, `hx-doctor.js`）
- **`src/scripts/lib/`** — 核心工具库：
  - `resolve-context.js` — 框架路径常量、查找项目根（`.hx/config.yaml` 或 `.git`）、构建三层查找根
  - `profile-utils.js` — Profile 加载与继承合并，内含自实现的轻量 YAML 解析器（无外部依赖）
  - `install-utils.js` — 安装/升级/卸载的文件操作工具
- **`src/agents/commands/`** — 工作流命令的 Prompt 定义（`.md` 文件），`hx setup` 后被注入为 Claude slash 命令或 Codex skill
- **`src/profiles/base/`** — 内置最小 profile，包含 `profile.yaml`, `golden-rules.md`, `review-checklist.md`, `requirement-template.md`, `plan-template.md`
- **`src/pipelines/default.yaml`** — 默认流水线定义，描述 `hx-go` 的执行步骤链（doc→plan→run→qa→mr）

### Profile 系统

Profile 按 `extends` 字段链式继承，合并规则：对象递归合并，数组整体替换，标量直接覆盖。`loadProfile()` 在 `profile-utils.js` 中实现，返回包含 `gateCommands`、`architecture`、`taskSplit`、`files`（各模板文件绝对路径）等字段的对象。

### Agent 命令 Contract

所有工作流命令统一为 `hx-*`（`hx-doc`, `hx-plan`, `hx-ctx`, `hx-run`, `hx-qa`, `hx-review`, `hx-fix`, `hx-clean`, `hx-mr`, `hx-status`, `hx-go`, `hx-init`）。Claude 使用 `/hx-*`，Codex 使用 `hx-*`，两端共享同一份 `.md` 命令定义文件。

## 发布

发布到内部私有 registry `https://npm.cdfsunrise.com/`（`publishConfig` 已配置）。发布前用 `npm run pack:dry-run` 确认打包文件列表，`package.json` 的 `files` 字段精确控制发布内容。

## 测试结构

- `tests/unit/` — 对 `src/scripts/lib/` 工具函数的单元测试
- `tests/integration/` — 对 `bin/hx.js` CLI 入口的集成测试
- vitest 配置中 `src/service` 路径设置了 80% 覆盖率门控（当前代码库不含该路径，配置来自模板）
