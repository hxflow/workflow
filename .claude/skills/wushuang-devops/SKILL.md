---
name: wushuang-devops
description: 通过 mcporter 调用中免日上 DevOps MCP（devops-api-prod）进行工具发现与 API 调用。用于用户要求”用 devops mcp 查询/执行任务、项目、用户、流水线、统计”等场景，或当需要先完成该 MCP 的本地配置与连通性验证时使用。
---

# wushuang-devops

使用 `mcporter` 直接调用 `devops-api-prod` MCP。

## 1) 先确保服务已配置

优先检查：

```bash
mcporter config get devops-api-prod --json
```

如果不存在，执行：

```bash
mcporter config add devops-api-prod \
  --command npx \
  --arg -y \
  --arg mcp-remote \
  --arg https://devops.cdfsunrise.com/devops-mcp \
  --arg --header \
  --arg "X-DevOps-Api-Key: ${DEVOPS_API_KEY}"
```

要求将密钥放在环境变量 `DEVOPS_API_KEY`，避免在命令历史和日志中明文暴露。

本地约定：`devops-api-prod` 配置中统一使用 `X-DevOps-Api-Key: ${DEVOPS_API_KEY}` 占位，不在 skill 或仓库配置中保存明文 key。

## 2) 做连通性与工具发现

```bash
mcporter list devops-api-prod
mcporter list devops-api-prod --schema
```

如果失败，先执行：

```bash
mcporter config doctor
```

## 3) 使用封装脚本调用（推荐）

优先使用脚本：`scripts/devops-call.sh`

```bash
# 连通性检查（配置 + 工具列表）
./scripts/devops-call.sh check

# 查看工具
./scripts/devops-call.sh list
./scripts/devops-call.sh list --schema

# 调用工具（参数按 key=value 透传）
./scripts/devops-call.sh call <tool-selector> key=value
```

例如：

```bash
./scripts/devops-call.sh call devops-api-prod.some_tool id=123
```

## 4) 直接用 mcporter（备用）

```bash
mcporter call <tool-selector> --output json
```

当用户不清楚参数时，先查看 schema，再最小化参数调用。

## 5) 输出规范

- 先给结论，再给关键字段。
- 对列表结果：按“总数 + 前 N 条摘要”输出。
- 对失败结果：给出错误原因、重试命令、下一步建议。

## 6) 安全要求

- 不在回复中回显完整 API Key。
- 仅在必要时展示脱敏头信息（例如前 4 位 + 掩码）。
- 若用户粘贴了明文密钥，提醒尽快轮换。