# @hxflow/cli

Project-rules-driven AI engineering workflow framework for AI agents. Zero-disruption installer for existing projects.

## 简介

`@hxflow/cli` 是面向团队工程师的工程交付工作流框架，用结构化配置、固定规则和 workflow skill 契约组织需求到交付的全过程。

当前模型分两层：

- `bin/hx.js` 直接执行维护命令和 code-first workflow 命令
- 仍未代码化的命令继续通过 agent command contract 提供

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

安装后需要手动运行一次 `hx setup`。该命令会初始化 `~/.hx/`，并把同一套 workflow skill 安装到 `~/.claude/skills/` 与 `~/.agents/skills/`。

## 快速开始

```bash
# 1. 安装包
npm install -g @hxflow/cli --registry https://npm.cdfsunrise.com/

# 2. 手动执行一次 setup
hx setup

# 3. 在项目目录中首次初始化
# Claude: /hx-init
# Codex:  hx-init

# 4. 开始开发
# Claude: /hx-go
# Codex:  hx-go
```

## CLI 命令

| 命令 | 用途 |
|------|------|
| `hx setup` | 手动重跑全局安装，修复 `~/.claude/skills/`、`~/.agents/skills/` 与 `~/.hx/` |
| `hx migrate [--dry-run]` | 将 1.x / 2.x 安装产物迁移到当前模型 |
| `hx version` | 查看版本号 |
| `hx-init` | 首次接入或骨架缺失时，通过 agent command contract 生成 `.hx/config.yaml` 与 `.hx/rules/*.md` |
| `hx-rules [update]` | 查看或更新当前项目规则事实 |

## 工作流命令

Canonical command contract 统一为 `hx-*`。Claude 使用 `/hx-*`，Codex 使用 `hx-*`。其中 `hx plan/run/check/mr/go` 与 `hx progress/feature/archive/restore/status` 已可由本地 CLI 直接执行。

### 一键自动化

| 命令 | 用途 |
|------|------|
| `hx-go [feature] [--from <step>] [--pipeline <name>]` | 全自动流水线，默认串起 `doc -> plan -> run -> check -> mr` |

### 核心链路命令

| 命令 | 阶段 | 用途 |
|------|------|------|
| `hx-init` | Init | 首次接入或骨架缺失时，通过 agent command contract 生成 `.hx/config.yaml` 与 `.hx/rules/*.md` |
| `hx-rules [update]` | Rules | 查看或更新项目规则事实 |
| `hx-doc` | Phase 01 | 获取需求并创建需求文档 |
| `hx-plan [feature]` | Phase 02 | 生成执行计划与 `progress.json`（含依赖和并行元数据） |
| `hx-run [feature] [--plan-task <id>]` | Phase 04 | 默认执行整个需求；`--plan-task` 仅用于调试/恢复单个计划任务 |
| `hx-check [--scope <review\|qa\|clean\|all>]` | Phase 06 | 统一执行审查、质量门和工程卫生扫描 |
| `hx-fix [--log <text>] [--file <path>]` | Fix | 根据检查结果或错误上下文修复问题 |
| `hx-mr [feature]` | Phase 08 | 生成 Merge Request 内容并自动归档 |
| `hx-status [feature]` | Status | 查看任务进度与下一步建议 |

### 环境维护命令

| 命令 | 用途 |
|------|------|
| `hx-cli <doctor\|upgrade\|uninstall\|issue> [options]` | 统一执行框架诊断、升级、卸载和问题反馈 |

说明：

- `feature` 是当前需求在项目内的稳定标识，通常由 `hx-doc` 自动生成并由后续命令自动续接
- 主路径优先使用 `hx-doc -> hx-plan -> hx-run -> hx-check -> hx-mr`，其中 `plan/run/check/mr/go` 已由本地脚本编排
- `hx-run` 开始前固定先校验输入完整性，再进入调度
- `hx-check` 统一承接审查、质量门和工程卫生扫描
- `hx-go` 当前可自动串联 `plan -> run -> check -> mr`；若起点仍在 `doc`，会返回阻断并提示先执行 `hx doc`
- 外部需求系统的编号如果存在，也只作为来源元数据保留，不再作为主链路参数

## 三层架构

```text
系统层  <frameworkRoot>/src/commands/ 命令正文、<frameworkRoot>/src/contracts/ 共享契约、pipelines
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

执行 `hx setup` 时会生成固定的 skill 入口：Claude Code 使用 `~/.claude/skills/`，其他 agent 统一使用 `~/.agents/skills/`。业务侧自定义 skill 仍由用户自行管理。

所有 `hx-*` 命令在执行前都会先继承 `src/contracts/runtime-contract.md` 的运行时规则，再进入各自的业务正文；解析优先级统一看 `src/contracts/resolution-contract.md`，`feature`、`progress` 等共享对象规则统一放在 `src/contracts/`。

## 自定义工作流 Skill

在项目 `.hx/commands/<name>.md` 中编写 prompt-first skill 定义，重新安装包或运行 `hx setup` 后即可被各 agent 发现。同名文件自动覆盖框架内置 skill。命令正文只需要描述业务步骤、输入输出和领域约束，不需要重复定义 command / hook / pipeline 的运行规则。

## 环境要求

- Bun >= 1.0.0
- Claude Code CLI 或 Codex

## 测试参考

- 测试流程说明：`docs/design/testing-reference.md`
- 全量回归：`bun run hx:test`
- 单测：`bun run hx:test:unit`
- 集成：`bun run hx:test:integration`

## License

MIT
