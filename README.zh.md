# @hxflow/workflow

Harness Workflow — 需求到交付的全自动流水线 Agent Skill。

[English](README.md)

---

## 简介

`hx` 是一个 Agent Skill，通过 `/hx <command>` 调用，组织需求到交付的全过程。

运行时事实文件：

- `.hx/config.yaml` — 单项目配置
- `.hx/workspace.yaml` — workspace 根配置（多项目）
- `.hx/rules/*.md` — 项目规则
- `.hx/hooks/` — 自定义 hook（可选）
- `.hx/pipelines/` — 自定义 pipeline（可选）

---

## 安装

```bash
npx skills add hxflow/workflow
```

安装后在目标项目中执行 `/hx init` 初始化。

---

## 使用

```
/hx go feature-name        # 全自动流水线
/hx doc feature-name       # 获取需求
/hx plan feature-name      # 生成计划
/hx run feature-name       # 执行需求
/hx check feature-name     # 质量检查
/hx mr feature-name        # 创建 MR
/hx reset feature-name [plan|doc|code]
```

---

## 命令

| 命令 | 阶段 | 说明 |
|------|------|------|
| `go` | 全流程 | 全自动流水线，串联 `doc → plan → run → check → mr` |
| `doc` | Phase 01 | 获取需求并创建需求文档 |
| `plan` | Phase 02 | 生成执行计划与 `progress.json` |
| `run` | Phase 04 | 执行需求任务 |
| `check` | Phase 06 | 质量检查（审查、质量门、工程卫生） |
| `mr` | Phase 08 | 创建 Merge Request |
| `init` | 初始化 | 生成配置文件与规则模板 |
| `status` | 状态 | 查看任务进度 |
| `reset` | 维护 | 重置需求、计划或执行状态 |

---

## 架构

```text
hxflow/
  SKILL.md              # Skill 入口，路由到命令
  commands/hx-*.md      # 命令定义
  scripts/tools/*.ts    # 事实工具脚本（AI 调用获取结构化数据）
  templates/            # 规则模板与默认配置
```

项目骨架：

```text
.hx/
  config.yaml           # 单项目模式
  workspace.yaml        # workspace 模式（多项目）
  rules/
    requirement-template.md
    plan-template.md
    bugfix-requirement-template.md
    bugfix-plan-template.md
  hooks/                # 可选
  pipelines/            # 可选
```

`hx-init` 会把规则模板落到 `.hx/rules/`，并在 `config.yaml`（或 `workspace.yaml`）的 `rules.templates` 中显式注册；运行时只认配置。

---

## Workspace 多项目

当仓库包含多个子服务时，`hx-init` 会扫描候选项目并生成 `.hx/workspace.yaml`：

- 根目录 `workspace.yaml` 维护协调层：`paths`、`gates`、`runtime`、`rules.templates`、`projects`
- 子项目可单独放 `config.yaml`，仅覆盖执行目录、源码路径与质量门；其他配置继承 workspace
- 需求/计划文档统一在 workspace 根目录维护，具体改动在 task 中落到对应服务
- 运行命令时先读 task 的 `cwd` 解析目标项目，再按优先级合并 workspace 与项目配置

---

## 环境要求

- Bun >= 1.0.0；未安装 Bun 时可通过 `npx tsx` 执行脚本

---

## 测试

```bash
bun run hx:test              # 全量回归
bun run hx:test:unit         # 单元测试
bun run hx:test:integration  # 集成测试
```

---

## 发布

- 仓库：`https://github.com/hxflow/workflow`
- npm registry：`https://npm.pkg.github.com`（`@hxflow` scope）
- 推送 `v*` tag 后自动触发发布
- 本地发布需提供 `NODE_AUTH_TOKEN`

---

## 持续评测

仓库内置 agent evals 骨架，位于 `hxflow/evals/`：

- `datasets/core.jsonl` — 主流程样本
- `datasets/edge.jsonl` — 边界条件
- `datasets/regressions.jsonl` — 历史回归样本
- `runs/history.json` — 趋势记录

```bash
bun run hx:evals:validate
bun hxflow/scripts/lib/evals.ts score tests/fixtures/evals/sample-results.json --write-run /tmp/hx-eval-run.json --record
bun run hx:evals:report
bun hxflow/scripts/lib/evals.ts extract-failures /tmp/hx-eval-run.json --output /tmp/hx-eval-candidates.jsonl
```

---

## License

MIT
