---
name: hx-check
description: 核心检查入口
usage: bun src/tools/check.ts [<feature>] [--scope <review|qa|clean|facts|all>]
---

# 核心检查入口

## 目标

实现完成后，执行审查、质量门和工程卫生扫描。

## 约束

- qa 只看 exit code，不看命令输出文本
- clean 只做扫描和报告，不修改任何文件
- review / clean 不直接执行修复
- review 对照 `review-checklist.md` 执行审查
- gate 失败时用 `bun src/tools/fix.ts` 修复后重试
- scope 说明：
  - `facts` — 纯事实（gates 配置、diff、规则路径）
  - `qa` — 执行质量门命令
  - `review` — 构造审查上下文，返回 `needsAiReview: true`
  - `clean` — 构造卫生扫描上下文
  - `all` — qa + review + clean
