---
name: hx-upgrade
description: 升级 Harness Workflow 框架
usage: hx-upgrade [--dry-run]
protected: true
---

# 升级 Harness Workflow 框架

参数: `$ARGUMENTS`（可选: `[--dry-run]`）

## 执行步骤

1. 更新系统层：
   - 若当前框架目录是 git 仓库，执行 `git pull`
   - 否则执行包管理器升级到最新版本
   - 传入 `--dry-run` 时仅输出计划
2. 重跑安装逻辑：
   - 补齐 `~/.hx/` 目录骨架，以及各 agent 的 skill 入口
   - 优先复用 `~/.hx/settings.yaml` 中已记录的 agents；首次缺失时提示用户选择
   - 当前目录属于项目时，同步更新 `CLAUDE.md` / `AGENTS.md` 标记块
   - 传入 `--dry-run` 时仅输出计划
3. 输出升级结果或 dry-run 计划。

## 失败处理

- `git pull` 认证失败：提示检查 SSH key 或 HTTPS 凭证
- `git pull` 冲突或本地脏改动：提示先处理框架目录改动
- `npm install` 网络或权限错误：提示检查网络、registry 或 npm 权限
- `~/.hx/settings.yaml` 或项目 `.hx/config.yaml` 解析失败：提示修复 YAML 格式
- `CLAUDE.md` / `AGENTS.md` 缺少标记块：提示先运行 `hx-init`
- 若判断为框架问题，说明依据，并询问用户是否通过 `hx-issue` 提交 Bug

## 约束

- 不依赖 `hx upgrade` CLI 脚本
- 先判断用户环境问题，再判断框架问题
- 不自动修改任何文件，诊断和修复建议仅供用户参考
- 传入 `--dry-run` 时，区分计划输出与真实失败
