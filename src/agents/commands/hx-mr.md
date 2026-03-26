---
name: hx-mr
description: Phase 08 · 创建 Merge Request
usage: hx-mr [<feature-key>] [--project <group/repo>] [--target <branch>]
claude: /hx-mr
codex: hx-mr
---

# Phase 08 · 创建 Merge Request

参数: `$ARGUMENTS`（格式: `[<feature-key>] [--project <group/repo>] [--target <branch>]`）

## 执行步骤

1. 解析参数：可选 `feature-key`、`--project`（可选）、`--target`（默认 `main`）
2. 确定 `feature key`：
   - 若传入 `feature-key`，直接作为当前需求的内部主键
   - 若未传入，则优先从当前会话最近一次 `hx-run` / `hx-plan` / `hx-doc` 的目标文档自动续接
   - 若仍无法唯一定位目标需求，则停止并要求用户补充 `feature-key`
3. 解析路径：读取 `.hx/config.yaml`（项目层）和 `~/.hx/config.yaml`（用户层）合并后的 `paths` 字段，将 `{feature}` 替换为实际值：

   | 字段 | 默认值 |
   |------|--------|
   | `paths.requirementDoc` | `docs/requirement/{feature}.md` |
   | `paths.progressFile` | `docs/plans/{feature}-progress.json` |

4. 加载前置 Hook（`mr-pre.md`，存在则作为 MR 模板补充要求注入）
5. 读取事实来源：
   - `requirementDoc`（需求、AC）
   - `progressFile`（任务完成状态）
   - `git log <target>..HEAD --oneline`（提交列表）
   - `git diff <target>...HEAD --stat`（变更概览）
6. 生成 MR 内容：
   - **标题**：简洁描述，格式 `feat: <feature-key> - <一句话摘要>`
   - **需求背景**：来自需求文档摘要
   - **变更说明**：按架构层级列出改动
   - **AC 验收清单**：来自需求文档，逐条标注完成状态
   - **任务完成情况**：`N/N 个任务完成`，列出 TASK 列表
   - **测试说明**：新增或修改的测试文件
7. 加载后置 Hook 并执行（`mr-post.md`）
8. 输出格式化的 MR 描述（Markdown），供复制到 GitLab/GitHub

## 约束

- `feature key` 是当前需求的唯一内部主键；正常情况下优先自动续接，不要求用户重复输入
- 若自动续接失败或存在歧义，才显式要求用户补充 `feature-key`

## Hook 路径

- `~/.hx/hooks/mr-pre.md` / `.hx/hooks/mr-pre.md`
- `~/.hx/hooks/mr-post.md` / `.hx/hooks/mr-post.md`
- `.hx/config.yaml` 的 `hooks.mr.pre` / `hooks.mr.post` 列表
