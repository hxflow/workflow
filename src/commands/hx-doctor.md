---
name: hx-doctor
description: 检测 Harness Workflow 环境健康状态
usage: hx-doctor
protected: true
---

# 检测 Harness Workflow 环境健康状态

参数: `$ARGUMENTS`（无参数）

## 执行步骤

1. 检查运行环境和全局安装：
   - Node 版本是否满足 `>= 18`
   - `~/.hx/settings.yaml`
   - `~/.hx/commands/`、`~/.hx/hooks/`、`~/.hx/pipelines/`
   - `~/.claude/skills/hx-*/SKILL.md`
   - `~/.codex/skills/hx-*/SKILL.md`
2. 检查当前项目：
   - 项目根下 `.hx/config.yaml`
   - `.hx/rules/*.md`
   - `paths.*` 指向的目录
   - `gates.*` 是否至少配置一项非空命令
3. 输出诊断结果，按正常、警告、失败分类。
4. 若存在失败项，询问用户是否继续修复，并按结果给出对应修复入口。

## 失败处理

- 全局适配层缺失：提示重新安装包或运行 `hx setup`
- 项目未初始化：提示运行 `hx-init`
- `~/.hx/settings.yaml` 或项目 `.hx/config.yaml` 格式错误：提示修复 YAML 语法
- `gates` 未配置：提示补充 lint / test / build 等命令
- 规则文件缺失：提示运行 `hx-init` 或 `hx-rules update`
- 若命令本身崩溃、模块加载失败或检测逻辑抛出内部异常，询问用户是否通过 `hx-issue` 提交 Bug

## 约束

- 不自动修改任何文件，修复步骤由用户确认后再执行
