# @hxflow/workflow

Harness Workflow — 需求到交付的全自动流水线 Agent Skill。

[English](README.md)

---

## 简介

`hx` 是一个 Agent Skill，通过 `/hx <command>` 调用，组织需求到交付的全过程。

运行时配置文件：

- `.hx/config.yaml` — 单项目配置
- `.hx/workspace.yaml` — workspace 根配置（多项目）
- `.hx/rules/*.md` — 项目规则模板
- `.hx/pipelines/` — 自定义 pipeline（可选）
- `.hx/hooks/` — 命令级 pre/post hook（可选）
- `.claude/settings.json`、`.codex/hooks.json` — `hx init` 生成的项目级 agent hook 注册

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
/hx review feature-name    # 质量评审
/hx test feature-name      # 真实端到端集成测试
/hx mr feature-name        # 创建 MR
/hx reset feature-name [plan|doc|code]
```

---

## 命令

| 命令 | 说明 |
|------|------|
| `go` | 全自动流水线，串联 `doc → plan → run → review → test → mr` |
| `doc` | 获取需求并创建需求文档 |
| `plan` | 生成执行计划与 `progress.json` |
| `run` | 执行需求任务 |
| `review` | 质量评审（审查、质量门、工程卫生） |
| `test` | 使用干净子 agent 做真实端到端集成测试 |
| `mr` | 创建 Merge Request |
| `init` | 生成配置、规则模板与默认 pipeline |
| `status` | 查看任务进度 |
| `reset` | 重置需求、计划或执行状态 |

---

## 架构

```text
hxflow/
  SKILL.md              # Skill 入口，路由 /hx <command>
  commands/hx-*.md      # 命令契约
  scripts/tools/*.ts    # 事实工具脚本（返回结构化 JSON）
  templates/            # 规则模板与默认 pipeline
```

`hx init` 生成的项目骨架：

```text
.hx/
  config.yaml           # 单项目模式
  workspace.yaml        # workspace 模式（多项目）
  rules/
    requirement-template.md
    plan-template.md
    bugfix-requirement-template.md
    bugfix-plan-template.md
  pipelines/
    default.yaml        # 默认 pipeline 定义
  hooks/                # 命令级 pre/post hook（可选）
    hxflow-guard-write-claude.ts
    hxflow-guard-write-codex.ts
```

---

## Hooks

在 `.hx/config.yaml` 中按命令配置 pre/post hook：

```yaml
runtime:
  hooks:
    doc:
      pre:
        - .hx/hooks/pre_doc.md   # hx doc 执行前注入
      post:
        - .hx/hooks/post_doc.md  # hx doc 执行后注入
```

在编辑器或 agent 的写入前 hook 中调用 `hx-hook guard-write`，阻止绕过 hxflow 的源码修改：

```bash
hx-hook guard-write --feature AUTH-001 src/api/auth.ts
```

该 guard 只检查 `paths.src` 下的路径。默认只在明确处于 hxflow 上下文时强制：显式传入 `--feature`、设置 `HX_FEATURE`，或能从唯一完整且活跃的 feature 文档组推断 feature。文档组必须包含 `docs/requirement/{feature}.md`、`docs/plans/{feature}.md` 和 `docs/plans/{feature}-progress.json`。启用后，它要求 `.hx` 配置、有效 feature 产物和可执行或可恢复的任务都存在；当 plan 声明了任务修改范围时，源码路径必须落在该范围内。设置 `HXFLOW_GUARD_MODE=strict` 可强制所有源码修改都走 hxflow。

`hx init` 默认安装 Claude Code 和 Codex 的项目级 hook adapter。已有 `.claude/settings.json` 或 `.codex/hooks.json` 不会被覆盖；如果你已经维护自定义 agent hook，需要把 `.hx/hooks/*` 中的命令合并到现有配置。

本仓库还注册了 agent 提交前 hook：agent 执行 `git commit` 前，`.agents/hooks/docs-sync-agent-hook.ts` 会检查 staged 文件。若 `hxflow/**` 已更新但没有 stage `docs/**` 文档更新，hook 会阻断提交并要求 agent 先同步和 stage 文档。

---

## Workspace 多项目

当仓库包含多个子服务时，`hx init` 会扫描候选项目并生成 `.hx/workspace.yaml`：

- 根目录 `workspace.yaml` 维护协调层：`paths`、`gates`、`runtime`、`rules.templates`、`projects`
- 子项目可单独放 `config.yaml`，仅覆盖执行目录、源码路径与质量门；其他配置继承 workspace
- 需求/计划文档统一在 workspace 根目录维护，具体改动在 task 中落到对应服务

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

---

## License

MIT
