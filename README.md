# @hxflow/cli

Profile-driven AI engineering workflow framework for Claude Code and Codex. Zero-disruption installer for existing projects.

## 简介

`@hxflow/cli` 是面向团队工程师的 AI-first 工作流框架，核心理念：**工程师不直接写业务代码，而是通过结构化文档 + Agent 执行的方式交付**。

框架内置最小 `base` profile，团队差异通过用户层或项目层自定义 profile 承载。

## 安装

```bash
npm install -g @hxflow/cli --registry https://npm.cdfsunrise.com/
```

## 快速开始

```bash
# 1. 全局安装框架文件（首次使用必跑）
hx setup

# 2. 在项目目录中初始化
# Claude: /hx-init
# Codex:  hx-init

# 3. 开始开发
# Claude: /hx-go <feature-key> --profile base
# Codex:  hx-go <feature-key> --profile base
```

## CLI 命令

| 命令 | 用途 |
|------|------|
| `hx setup [--agent <claude|codex|all>]` | 全局安装，生成 Claude/Codex 适配层并初始化 `~/.hx/` |
| `hx upgrade [--dry-run]` | 升级系统层并同步自定义命令 |
| `hx uninstall [--yes]` | 移除全部安装痕迹 |
| `hx doctor` | 健康检测（环境、安装、项目配置） |
| `hx version` | 查看版本号 |

## 工作流命令

Canonical command contract 统一为 `hx-*`。Claude 使用 `/hx-*`，Codex 使用 `hx-*`。

### 一键自动化

| 命令 | 用途 |
|------|------|
| `hx-go [feature-key] [--from <step>] --profile <name>` | 全自动流水线，Phase 01→08 |

### 单步命令

| 命令 | 阶段 | 用途 |
|------|------|------|
| `hx-doc [feature-key|标题] [--task <id>] --profile <name>` | Phase 01 | 获取需求并创建需求文档（内部自动生成唯一主键） |
| `hx-plan [feature-key] --profile <name>` | Phase 02 | 生成执行计划（可自动续接上一份需求文档） |
| `hx-ctx [feature-key] [--profile <name>]` | Phase 03 | 当前需求执行前预检（可选诊断） |
| `hx-run [feature-key] [--task <id>] --profile <name>` | Phase 04 | 默认执行整个需求；`--task` 仅用于调试/恢复 |
| `hx-review [--profile <name>]` | Phase 05 | 代码审查 |
| `hx-qa [--profile <name>]` | Phase 06 | 运行质量校验 |
| `hx-fix [--profile <name>]` | Phase 05 | 修复 Review 意见 |
| `hx-clean [--profile <name>]` | Phase 07 | 工程清理扫描 |
| `hx-mr [feature-key]` | Phase 08 | 输出 Merge Request 创建上下文（可自动续接） |

## Profile 系统

所有命令支持 `--profile` 参数指定 profile 名称：

```bash
--profile base             # 内置最小 profile
--profile my-team          # 用户/项目自定义 profile
--profile go-ddd           # 共享 profile 示例
```

## 三层架构

```
系统层  <frameworkRoot>/src/agents/   命令实体、profiles（git pull 升级）
用户层  ~/.hx/                        用户自定义覆盖（跨项目共享）
项目层  <project>/.hx/               项目专属覆盖（最高优先级）
```

每层结构一致：`commands/`、`profiles/`、`pipelines/`、`config.yaml`

框架层只保证 `profiles/base/` 存在；其他 profile 均由用户或项目自行维护。

Claude 转发器和 Codex skill bundle 由 `hx setup` / `hx upgrade` 生成；业务侧自定义 skill 仍由用户自行管理。

## 自定义工作流命令

在项目 `.hx/commands/<name>.md` 中编写 prompt-first 命令定义，运行 `hx upgrade` 后即可被 Claude/Codex 适配层发现。同名文件自动覆盖框架内置命令。

## 环境要求

- Node.js >= 18.0.0
- Claude Code CLI 或 Codex

## License

MIT
