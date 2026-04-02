---
name: hx-cli
description: 维护 Harness Workflow CLI 与安装产物
usage: hx-cli <doctor|issue> [options]
protected: true
---

# 维护 Harness Workflow CLI 与安装产物

## 目标

- 用一个命令统一承接框架诊断和问题反馈。

## 何时使用

- 适用场景：需要维护 HXFlow 自身，而不是处理业务需求交付链路。
- 不适用场景：正常需求实现、检查和修复时，优先使用 `hx-doc`、`hx-plan`、`hx-run`、`hx-check`、`hx-fix`、`hx-mr`。

## 输入

- 命令参数：`$ARGUMENTS`
- 必选参数：`<doctor|issue>`
- 可选参数：`--title <title>`、`--body <text>`、`--no-ai`
- 默认值：`issue` 未传 `--no-ai` 时默认附加 `ai-fix` label
- 依赖输入：`~/.hx/settings.yaml`、当前项目 `.hx/config.yaml` 与规则目录、Bug 描述、`$GITLAB_TOKEN`

## 执行步骤

1. 解析子命令，确定本次执行 `doctor` 或 `issue`。
2. `doctor`：检查 Node 版本、`~/.hx/settings.yaml`、用户级目录骨架、skill 入口、当前项目 `.hx/config.yaml`、规则目录、`paths.*` 和 `gates.*`。
3. `issue`：收集标题、正文、复现步骤和相关错误信息，调用 GitLab API 向 `frontend/qybot/qiyuan-harness-guide` 创建 issue。
4. 输出本次维护动作的结果、失败项和推荐下一步。

## 成功结果

- `doctor`：输出环境健康报告，区分正常项、警告项和失败项。
- `issue`：输出 issue 标题、编号、链接和 label 信息。

## 失败边界

- 子命令不合法，或缺少关键参数。
- issue 提交依赖的外部条件不满足。
- 检测逻辑本身崩溃，或关键路径不可读。

## 下一步

- `doctor` 发现问题时，优先运行 `hx setup`、`hx-init`、`hx-rules update` 或 `hx-cli issue`。
- `issue` 创建成功后保留 issue 链接跟踪；失败时补齐参数或环境变量后重试。

## 失败处理

- `doctor` 发现安装产物缺失：提示重新安装包或运行 `hx setup`
- `issue` 缺少 `$GITLAB_TOKEN`：提示用户先配置环境变量
- 若判断为框架问题但未能自动处理，说明依据，并建议通过 `hx-cli issue` 提交 Bug

## 约束

- `doctor` 不自动修改任何文件。
- `issue` 不修改 issue 之外的任何仓库内容，也不自动重试失败请求。
