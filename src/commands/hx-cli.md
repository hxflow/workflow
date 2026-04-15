---
name: hx-cli
description: 维护 Harness Workflow CLI 与安装产物
usage: hx-cli <doctor|issue> [options]
---

# 维护 Harness Workflow CLI 与安装产物

## 目标

统一承接框架诊断和问题反馈。

## 何时使用

- 需要维护 HXFlow 自身（诊断、报 Bug）。
- 正常需求交付使用 `hx-doc`、`hx-run` 等 skill。

## 输入

- 命令参数：`$ARGUMENTS`
- 必选参数：`<doctor|issue>`
- 可选参数：`--title <title>`、`--body <text>`、`--no-ai`
- 默认值：`issue` 未传 `--no-ai` 时默认附加 `ai-fix` label
- 依赖输入：`~/.hx/settings.yaml`、`.hx/config.yaml`、`$GITLAB_TOKEN`

## 执行步骤

1. `doctor`：检查 Node 版本、`~/.hx/settings.yaml`、用户级目录骨架、skill 入口、`.hx/config.yaml`、规则目录、`paths.*` 和 `gates.*`。
2. `issue`：收集标题、正文和复现步骤，调用 GitLab API 创建 issue。
3. 输出结果、失败项和推荐下一步。

## 成功结果

- `doctor`：环境健康报告（正常/警告/失败项）。
- `issue`：issue 标题、编号和链接。

## 失败边界

- 子命令不合法或缺少关键参数。
- issue 提交依赖的外部条件不满足（如缺 `$GITLAB_TOKEN`）。

## 下一步

- `doctor` 发现问题时运行 `hx setup`、`bun src/tools/init.ts` 或 `bun src/tools/rules.ts update`。
- `issue` 创建成功后保留链接跟踪。

## 失败处理

- `doctor` 发现安装产物缺失：提示重新安装或运行 `hx setup`
- `issue` 缺少 `$GITLAB_TOKEN`：提示配置环境变量
- 判断为框架问题但未能自动处理时，建议通过 `hx-cli issue` 提交 Bug

## 约束

- `doctor` 不修改任何文件
- `issue` 不修改 issue 之外的仓库内容，不自动重试
