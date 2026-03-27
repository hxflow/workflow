---
name: hx-issue
description: 向框架仓库提交 Bug Issue
usage: hx-issue [--title <title>] [--body <text>] [--no-ai]
claude: /hx-issue
codex: hx-issue
protected: true
---

# 向框架仓库提交 Bug Issue

参数: `$ARGUMENTS`（格式: `[--title <title>] [--body <text>] [--no-ai]`）

## 目标仓库

- GitLab: `https://gitlab.cdfsunrise.com/frontend/qybot/qiyuan-harness-guide`
- API Base: `https://gitlab.cdfsunrise.com/api/v4/projects/frontend%2Fqybot%2Fqiyuan-harness-guide`
- Token: 从环境变量 `$GITLAB_TOKEN` 读取

## 执行步骤

1. **解析参数**
   - `--title <title>`：issue 标题（可选，不提供则进入交互式收集）
   - `--body <text>`：issue 正文（可选）
   - `--no-ai`：跳过 AI 自动处理，不添加 `ai-fix` label（仅记录，人工处理）

2. **收集 issue 信息**（未通过参数提供时）
   - 询问用户：**Bug 描述**（必填）—— 发生了什么、期望行为、实际行为
   - 询问用户：**复现步骤**（可选）
   - 询问用户：**相关文件或命令**（可选）

3. **生成结构化 issue 内容**

   标题格式：`bug: {简洁描述}`

   正文模板：
   ```
   ## 问题描述
   {bug 描述}

   ## 期望行为
   {期望是什么}

   ## 实际行为
   {实际发生了什么}

   ## 复现步骤
   {步骤列表，若有}

   ## 相关信息
   {文件路径、命令、错误日志等，若有}
   ```

4. **创建 GitLab Issue**

   ```bash
   curl -s --request POST \
     --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
     --header "Content-Type: application/json" \
     --data "{\"title\": \"<title>\", \"description\": \"<body>\", \"labels\": \"ai-fix\"}" \
     "https://gitlab.cdfsunrise.com/api/v4/projects/frontend%2Fqybot%2Fqiyuan-harness-guide/issues"
   ```

   若传入 `--no-ai`，则 labels 为空字符串，不触发自动修复流程。

5. **输出结果**
   - 显示创建成功的 issue 编号和链接（`web_url` 字段）
   - 若添加了 `ai-fix` label，提示"已标记为 AI 自动修复，将在下一个轮询周期内处理"

## 约束

- 若 `$GITLAB_TOKEN` 未设置，提示用户在 `.claude/settings.local.json` 的 `env` 中配置
- 创建失败时输出 API 错误信息，不重试
