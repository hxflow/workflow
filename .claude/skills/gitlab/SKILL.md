---
name: gitlab
description: 使用本地 gitlab 脚本通过 GitLab API 执行常见操作（创建/查询 Merge Request、查询项目信息）。当用户要求创建 MR、查看 MR 列表、检查项目信息时使用。
---

# gitlab

通过 `scripts/gitlab` 调用 GitLab API。

## 1) 前置条件

- 已安装 `curl` 与 `jq`
- 已设置环境变量：

```bash
export GITLAB_TOKEN="<your_pat>"
# 可选
export GITLAB_URL="https://gitlab.cdfsunrise.com"
```

## 2) 常用命令

```bash
# 查看帮助
./scripts/gitlab help

# 创建 MR
./scripts/gitlab mr create -s feature/xxx -t main --title "xxx" -p lehu/bffservice

# 列 MR（默认 opened）
./scripts/gitlab mr list -p lehu/bffservice --state opened

# 查看 MR 详情
./scripts/gitlab mr view -p lehu/bffservice -i 123

# 给 MR 添加评论
./scripts/gitlab mr note -p lehu/bffservice -i 123 -b "请补一下测试说明"

# 查看 MR 检查状态（CI/可合并/讨论）
./scripts/gitlab mr checks -p lehu/bffservice -i 123

# 持续监控 MR，直到 CI 结束（前台）
./scripts/gitlab mr watch -p lehu/bffservice -i 123 -n 20 -m 180

# 持续监控 MR（后台，推荐）
./scripts/gitlab mr watch -p lehu/bffservice -i 123 -B
# 指定日志文件
./scripts/gitlab mr watch -p lehu/bffservice -i 123 -B -l /tmp/mr-123-watch.log
# 查看后台日志
./scripts/gitlab mr watch-log -p lehu/bffservice -i 123 --lines 80
# 停止后台监控
./scripts/gitlab mr watch-stop -p lehu/bffservice -i 123

# 生成子代理监控任务模板
./scripts/gitlab mr delegate-watch -p lehu/bffservice -i 123

# 查项目信息
./scripts/gitlab project info -p lehu/bffservice
```

## 3) 子代理监控（推荐）

当需求是"持续盯 MR/CI 并在失败后继续跟进"时，优先使用子代理而不是前台阻塞。

子代理任务模板（给 sessions_spawn 的 task）：

```
监控 GitLab MR 状态直到结束：
- 项目: <group/project>
- MR IID: <iid>
- 每 30 秒检查一次
- 使用命令: "./scripts/gitlab" mr checks -p <group/project> -i <iid>
- 若 CI 成功：汇报成功并附 MR 链接
- 若 CI 失败/取消：汇报失败状态、pipeline 链接、未解决讨论数，并给出下一步修复建议
- 最长监控 3 小时
```

## 4) 使用规则

- 优先显式传 `--project`，避免仓库 remote 解析失败。
- 创建 MR 时若描述较长，使用 `-d @desc.md`。
- 先给结果（成功/失败），再给关键字段（MR 链接、IID、状态）。

## 5) 故障排查

- 未设置 GITLAB_TOKEN：先导出 token 再执行。
- 404 project not found：确认项目路径是否正确（group/project）。
- 401/403：检查 token 权限（至少 API scope）。

## 6) 安全要求

- 不在回复里回显完整 token。
- 不把 token 写入仓库文件或命令历史。
