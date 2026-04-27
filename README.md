# @hxflow/workflow

Harness Workflow — Agent Skill for requirement-to-delivery pipeline.

## 简介

`hx` 是一个 Agent Skill，通过 `/hx <command>` 调用，组织需求到交付的全过程。

项目运行时事实：

- `.hx/config.yaml` — 单项目配置
- `.hx/workspace.yaml` — workspace 根配置（多项目）
- `.hx/rules/*.md` — 项目规则
- `.hx/hooks/` — 项目自定义 hook（可选）
- `.hx/pipelines/` — 项目自定义 pipeline（可选）

## 安装

```bash
npx skills add hxflow/workflow
```

安装后在目标项目中执行 `/hx init` 初始化。

## 使用

```
/hx go feature-name        # 全自动流水线
/hx doc feature-name        # 获取需求
/hx plan feature-name       # 生成计划
/hx run feature-name        # 执行需求
/hx check feature-name      # 质量检查
/hx mr feature-name         # 创建 MR
/hx reset feature-name [plan|doc|code]  # 不带参数时重置 code、doc、plan
```

## 命令

| 命令 | 阶段 | 说明 |
|------|------|------|
| `go` | 全流程 | 全自动流水线，串联 `doc → plan → run → check → mr` |
| `doc` | Phase 01 | 获取需求并创建需求文档 |
| `plan` | Phase 02 | 生成执行计划与 `progress.json` |
| `run` | Phase 04 | 执行需求任务 |
| `check` | Phase 06 | 质量检查（审查、质量门、工程卫生） |
| `mr` | Phase 08 | 创建 Merge Request |
| `init` | 初始化 | 生成 `.hx/config.yaml` 与 `.hx/rules/*.md` |
| `status` | 状态 | 查看任务进度 |
| `reset` | 维护 | 重置需求、计划或执行状态 |

## 架构

```text
hxflow/
  SKILL.md              Skill 入口，路由到命令
  commands/hx-*.md      命令定义
  scripts/tools/*.ts    事实工具脚本（AI 调用获取结构化数据）
  templates/            模板文件
```

项目骨架：

```text
.hx/
  config.yaml             # 单项目模式
  workspace.yaml          # workspace 模式（多项目）
  rules/
    bugfix-plan-template.md
    bugfix-requirement-template.md
    requirement-template.md
    plan-template.md
  hooks/                  (可选)
  pipelines/              (可选)
```

`hx-init` 会把这些规则模板直接落到 `.hx/rules/`，并在 `.hx/config.yaml`（或 workspace 模式下的 `.hx/workspace.yaml`）的 `rules.templates` 中显式注册；运行时只认配置。

## Workspace 多项目

当仓库包含多个子服务时，`hx-init` 会扫描候选项目并生成 `.hx/workspace.yaml`，形成 workspace 模式：

- 根目录 `.hx/workspace.yaml` 维护协调层：`paths`、`gates`、`runtime`、`rules.templates`、`projects`
- 子项目可单独放 `.hx/config.yaml`，仅覆盖执行目录、源码路径与质量门；其他配置继承 workspace
- `docs/requirement/{feature}.md`、`docs/plans/{feature}.md` 统一在 workspace 根目录维护，具体改动在 task 中落到对应服务
- 运行 `hx doc/plan/run/check` 时先读 task 的 `cwd` 解析到目标项目，再按优先级合并 workspace 与项目配置
- 单项目目录不做额外服务归属判断

运行时入口、hook 解析、脚本路由与全局回退规则直接在 `hxflow/SKILL.md` 中定义，不再单独维护 `runtime-contract.md`。
命令级 hook 与 pipeline 都只从 `.hx/config.yaml` 的 `runtime.hooks`、`runtime.pipelines` 显式注册，不再提供框架默认值。

## Agent 运行与观察

如果在支持后台 agent / shell 的运行时里使用本仓库，建议把“启动”和“读取结果”分开看：

| 场景 | 查看列表 | 读取输出 | 继续交互 |
|------|------|------|------|
| 后台 agent | `list_agents` | `read_agent` | `write_agent` |
| 后台 shell / bash | `list_bash` | `read_bash` | `write_bash` |

- `read_agent` / `write_agent` 只用于后台 agent，不要和 shell 会话混用
- `read_bash` / `write_bash` 只用于 bash 会话；需要检查长任务结果时优先读已有 shell，而不是重复启动
- agent 处于 idle、等待补充信息时再用 `write_agent`；只做一次性结果读取时用 `read_agent`

## 环境要求

- Bun >= 1.0.0；若未安装 Bun，也可使用 Node.js 运行并通过 `npx tsx` 执行 `hxflow/scripts/**/*.ts`

## 发布

- 当前发布仓库：`https://github.com/hxflow/workflow`
- npm 包发布到 GitHub Packages：`https://npm.pkg.github.com`
- 推送 `v*` tag 到 GitHub 后自动触发发布 workflow
- 本地发布前在环境中提供 `NODE_AUTH_TOKEN`
- 项目 `.npmrc` 已固定 `@hxflow` scope 到 GitHub Packages

## 测试

- 全量回归：`bun run hx:test`
- 单测：`bun run hx:test:unit`
- 集成：`bun run hx:test:integration`
- 运行时脚本：命令契约中的 `bun scripts/...` 统一表示脚本入口；若未安装 Bun，则按 `hxflow/SKILL.md` 的全局规则改用 `npx tsx scripts/...`

## 持续评测

仓库内置了一套可迭代的 agent evals 骨架，位置在 `hxflow/evals/`：

- `datasets/core.jsonl`：主流程样本
- `datasets/edge.jsonl`：边界条件
- `datasets/regressions.jsonl`：历史翻车样本
- `runs/history.json`：趋势记录
- `hxflow/scripts/lib/evals.ts`：校验、评分、报告、失败样本提取、OpenAI payload 导出

常用命令：

```bash
bun run hx:evals:validate
bun hxflow/scripts/lib/evals.ts score tests/fixtures/evals/sample-results.json --write-run /tmp/hx-eval-run.json --record
bun run hx:evals:report
bun hxflow/scripts/lib/evals.ts extract-failures /tmp/hx-eval-run.json --output /tmp/hx-eval-candidates.jsonl
```

这套机制的重点不是一次性打分，而是持续把失败样本沉淀进 `regressions.jsonl`，让模型、prompt、命令契约和脚本改动都能做回归对比。

当前方案只保留本地手动执行，不再内置 GitHub Actions、GitHub Models 或 OpenAI API 依赖。用户可以先在本地生成结果文件，再调用 `score / report / extract-failures` 完成评测、趋势查看和回归样本沉淀。

## License

MIT
