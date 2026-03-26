---
name: hx-doc
description: Phase 01 · 获取需求并创建需求文档
usage: hx-doc [<feature-key-or-title>] [--task <task-id>] [--profile <name>]
claude: /hx-doc
codex: hx-doc
---

# Phase 01 · 获取需求并创建需求文档

参数: `$ARGUMENTS`（格式: `[<feature-key-or-title>] [--task <task-id>] [--profile <name>]`）

## 执行步骤

1. 解析参数：提取可选首个位置参数、`--task`（可选）、`--profile`（可选）
2. 解析需求来源模式：
   - 若传入 `--task <task-id>`，进入“任务拉取模式”：优先通过已连接的 DevOps / 任务系统能力获取任务详情；至少提取任务标题、描述、优先级、验收口径、关联链接/上游需求
   - 若未传 `--task`，进入“手工整理模式”：基于当前会话中用户提供的需求描述、会议结论或已有文档整理需求文档
   - 若无法获取任务详情，且当前会话也没有足够的人工需求信息，则停止创建并明确告知缺少需求来源，禁止凭空生成空文档
3. 生成需求标题与 `feature key`：
   - 若首个位置参数已是 kebab-case，则直接作为 `feature key`，并基于需求来源补出中文标题
   - 若首个位置参数不是 kebab-case，则视为人类可读标题（可为中文），由 AI 生成稳定的 kebab-case `feature key`
   - 若首个位置参数缺失，则由 AI 直接基于任务详情或需求描述生成“中文标题 + kebab-case feature key”
   - `feature key` 必须短、稳定、可复用，避免把冗长句子、时间戳或任务号直接塞进 key
   - `feature key` 是项目内唯一的内部主键；生成后必须检查目标 `requirementDoc`、`planDoc`、`progressFile` 是否已存在同 key 资源
   - 若发现冲突：
     - 若冲突文档明确属于同一需求，则复用该 `feature key`
     - 若属于不同需求，则必须重新生成一个不冲突的新 key，再继续创建
4. 解析路径：读取 `.hx/config.yaml`（项目层）和 `~/.hx/config.yaml`（用户层）合并后的 `paths` 字段，以下字段缺失时使用默认值，将 `{feature}` 替换为生成后的 `feature key`：

   | 字段 | 默认值 |
   |------|--------|
   | `paths.requirementDoc` | `docs/requirement/{feature}.md` |

5. 解析 Profile：
   - 优先 `--profile`；否则读 `.hx/config.yaml` 的 `defaultProfile`
   - 按顺序查找：`.hx/profiles/<name>/` → `~/.hx/profiles/<name>/` → 框架内置 `profiles/<name>/`
   - 读取 `profile.yaml`，处理 `extends:` 继承链
6. 加载前置 Hook（存在则作为额外约束）：
   - `~/.hx/hooks/doc-pre.md`、`.hx/hooks/doc-pre.md`
   - `.hx/config.yaml` 的 `hooks.doc.pre` 路径列表
7. 从 profile 目录读取 `requirement-template.md`
8. 基于模板创建 `requirementDoc`：
   - 自动填入当前日期、team/platform 信息
   - 自动填入“需求标题”和 `feature key`
   - 若提供 `--task`，在文档头部写入 `来源任务：#<task-id>`，并将拉取到的任务标题、描述、验收口径整理进“背景 / 验收标准 / 依赖文档 / 设计决策”对应栏目
   - 若未提供 `--task`，则将当前会话中的需求描述整理进模板；缺失的栏目保留明确待补位置，但不能把关键信息写成虚构内容
   - 对从外部任务系统拉取到的内容做结构化改写：删除口语化噪音，保留约束、边界、验收标准和关联信息
9. 加载后置 Hook 并执行额外指令（`doc-post.md`）
10. 输出：
   - `✓ 需求文档已创建: <requirementDoc 路径>`
   - `标题: <中文标题>`
   - 正常情况下不主动展示 `Feature Key`
   - 若发生冲突、歧义，或后续步骤无法自动定位，再显式展示 `Feature Key: <feature-key>`
   - 下一步优先提示 `hx-plan --profile <name>`；只有无法自动续接时，才提示带 `feature key` 的完整命令

## 约束

- `requirementDoc` 所在目录不存在则自动创建
- 不修改已存在的同名文档（提示用户确认后再覆盖）
- `feature key` 是项目内唯一的内部主键；后续 `hx-plan` / `hx-run` / `hx-go` 等命令统一使用它
- `feature key` 默认属于内部实现细节；除非发生冲突、歧义或定位失败，否则不要把它作为用户主要心智暴露
- 若 AI 自动生成的 `feature key` 明显歧义或过长，必须先给出修正后的 key，再继续创建文档
- `--task` 不再只是追溯编号；它表示“从任务系统获取需求来源并预填文档”
- 若任务来源信息不足以形成可执行需求文档，必须显式列出缺口，不能凭空补齐验收标准
