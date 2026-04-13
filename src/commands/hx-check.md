---
name: hx-check
description: 核心检查入口
usage: hx-check [<feature>] [--scope <review|qa|clean|all>]
hooks:
  - pre
  - post
---

# 核心检查入口

## 目标

实现完成后，执行审查、质量门和工程卫生扫描。

## 使用方式

```bash
hx check [<feature>] [--scope <review|qa|clean|all>]
```

`hx check` 会自动完成以下工作：
- 读取 `.hx/config.yaml` 中配置的 gate 命令
- 定位 review-checklist.md 和 golden-rules.md
- 执行 `qa` scope 下的 gate 命令
- 为 `review / clean` 构造最小检查上下文并调用 AI
- 输出结构化检查结果与下一步建议

## AI 职责

- `review`：对照 review-checklist.md 执行审查，输出发现摘要
- `clean`：扫描调试代码、dead code、文档一致性问题，输出发现摘要
- `qa` 不交给 AI，由代码顺序执行 gate 命令

## 约束

- qa 只看 exit code，不看命令输出文本
- 传给 AI 的上下文只包含 diff、规则路径、gate 结果和必要元信息
- clean 只做扫描和报告，不修改任何文件
- review / clean 不直接执行修复
- 存在 blocker 或 gate 失败时，运行 `hx fix <feature>` 或人工修复后重试
