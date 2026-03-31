# @hxflow/cli

Project-rules-driven AI engineering workflow framework for AI agents. Zero-disruption installer for existing projects.

## 简介

`@hxflow/cli` 是面向团队工程师的工程交付工作流框架，用结构化配置、固定规则和 workflow skill 契约组织需求到交付的全过程。

运行时事实已经收敛为：

- `.hx/config.yaml`
- `.hx/rules/*.md`
- `.hx/hooks/`
- `.hx/commands/`
- `.hx/pipelines/`

运行时统一读取项目内的规则文件、结构化配置与扩展目录。

## 安装

```bash
npm install -g @hxflow/cli --registry https://npm.cdfsunrise.com/
```

安装后需要手动运行一次 `hx setup`。该命令会初始化 `~/.hx/` 与各 agent 的 skill 入口，并把本次选择的 agents 记录到 `~/.hx/settings.yaml`，后续修复或重跑默认复用这份选择。

## 快速开始

```bash
# 1. 安装包
npm install -g @hxflow/cli --registry https://npm.cdfsunrise.com/

# 2. 手动执行一次 setup
hx setup

# 3. 在项目目录中初始化
# Claude: /hx-init
# Codex:  hx-init

# 4. 开始开发
# Claude: /hx-go
# Codex:  hx-go
```

## CLI 命令

| 命令 | 用途 |
|------|------|
| `hx setup` | 手动重跑全局安装，修复各 agent 的 skill 入口与 `~/.hx/` |
| `hx version` | 查看版本号 |
| `hx-init` | 扫描当前项目并生成 `.hx/config.yaml` 与 `.hx/rules/*.md` |
| `hx-rules [update]` | 查看或更新当前项目规则事实 |

## 工作流命令

Canonical command contract 统一为 `hx-*`。Claude 使用 `/hx-*`，Codex 使用 `hx-*`。

### 一键自动化

| 命令 | 用途 |
|------|------|
| `hx-go [feature] [--from <step>] [--pipeline <name>]` | 全自动流水线，默认串起 `doc -> plan -> run -> qa -> mr` |

### 核心链路命令

| 命令 | 阶段 | 用途 |
|------|------|------|
| `hx-init` | Init | 扫描项目并生成 `.hx/config.yaml` 与 `.hx/rules/*.md` |
| `hx-rules [update]` | Rules | 查看或更新项目规则事实 |
| `hx-doc` | Phase 01 | 获取需求并创建需求文档 |
| `hx-plan [feature]` | Phase 02 | 生成执行计划与 `progress.json` |
| `hx-ctx [feature]` | Phase 03 | 当前需求执行前预检（可选诊断） |
| `hx-run [feature] [--plan-task <id>]` | Phase 04 | 默认执行整个需求；`--plan-task` 仅用于调试/恢复单个计划任务 |
| `hx-qa` | Phase 06 | 运行质量校验 |
| `hx-mr [feature]` | Phase 08 | 输出 Merge Request 创建上下文 |

### 辅助命令

| 命令 | 用途 |
|------|------|
| `hx-review` | 代码审查 |
| `hx-fix [--log <text>] [--file <path>]` | 修复 Review 意见 |
| `hx-clean` | 工程清理扫描 |
| `hx-status [feature]` | 查看任务进度 |
| `hx-upgrade [--dry-run]` | 升级框架并同步安装产物 |
| `hx-uninstall [--target <dir>] [--dry-run]` | 卸载安装痕迹 |
| `hx-doctor` | 检测环境、安装与项目配置健康状态 |

说明：

- `feature` 是当前需求在项目内的稳定标识，通常由 `hx-doc` 自动生成并由后续命令自动续接
- 主路径优先使用 `hx-doc -> hx-plan -> hx-run -> hx-qa -> hx-mr`
- `hx-ctx`、`hx-review`、`hx-fix`、`hx-clean` 都属于按需使用的辅助能力
- 外部需求系统的编号如果存在，也只作为来源元数据保留，不再作为主链路参数

## 三层架构

```text
系统层  <frameworkRoot>/src/commands/ 内置 workflow skill 实体、pipelines
用户层  ~/.hx/                        用户自定义 commands/hooks/pipelines（跨项目共享）
项目层  <project>/.hx/               项目 config/rules 与专属覆盖（最高优先级）
```

项目层核心骨架：

```text
.hx/
  config.yaml
  rules/
    golden-rules.md
    review-checklist.md
    requirement-template.md
    plan-template.md
  hooks/
  commands/
  pipelines/
```

各 agent 的 skill 入口在装包时自动生成；`hx setup` 首次会列出 agent 清单供用户选择，后续默认复用 `~/.hx/settings.yaml` 中记录的 agents。业务侧自定义 skill 仍由用户自行管理。

## 自定义工作流 Skill

在项目 `.hx/commands/<name>.md` 中编写 prompt-first skill 定义，重新安装包或运行 `hx setup` 后即可被各 agent 发现。同名文件自动覆盖框架内置 skill。

## 环境要求

- Node.js >= 18.0.0
- Claude Code CLI 或 Codex

## 测试参考

- 测试流程说明：`docs/design/testing-reference.md`
- 全量回归：`./node_modules/.bin/vitest run`
- npm 脚本：`npm run hx:test` / `npm run hx:test:unit` / `npm run hx:test:integration`

## License

MIT
