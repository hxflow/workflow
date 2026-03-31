---
name: hx-mr
description: Phase 08 · 创建 Merge Request
usage: hx-mr [<feature>] [--project <group/repo>] [--target <branch>]
hooks:
  - pre
  - post
---

# Phase 08 · 创建 Merge Request

参数: `$ARGUMENTS`（格式: `[<feature>] [--project <group/repo>] [--target <branch>]`）

## 执行步骤

1. 解析参数，提取 `feature`、`--project`、`--target`。
2. 确定 `feature`：
   - 若传入 `feature`，直接作为当前需求的项目内稳定标识
   - 若未传入，则优先从当前会话最近一次 `hx-run` / `hx-plan` / `hx-doc` 的目标文档自动续接
   - 若仍无法唯一定位目标需求，则停止并要求用户补充 `feature`
3. 读取项目 `.hx/config.yaml` 和用户级 `~/.hx/settings.yaml`，解析当前需求对应的 `requirementDoc` 与 `progressFile`。
4. 读取事实来源：
   - `requirementDoc`（需求、AC）
   - `progressFile`（任务完成状态）
   - `git log <target>..HEAD --oneline`（提交列表）
   - `git diff <target>...HEAD --stat`（变更概览）
5. 生成 MR 内容：
   - **标题**：简洁描述，格式 `feat: <feature> - <一句话摘要>`
   - **需求背景**：来自需求文档摘要
   - **变更说明**：按架构层级列出改动
   - **AC 验收清单**：来自需求文档，逐条标注完成状态
   - **任务完成情况**：`N/N 个任务完成`，列出 TASK 列表
   - **测试说明**：新增或修改的测试文件
6. 输出格式化的 MR 描述（Markdown）。

## 约束

- `feature` 是当前需求在项目内的稳定标识；正常情况下优先自动续接，不要求用户重复输入
- 若自动续接失败或存在歧义，才显式要求用户补充 `feature`
- `feature` 只允许读取已有需求上下文，不允许在 MR 阶段重算
