---
name: hx-review
description: Phase 05 · 代码审查
usage: hx-review [--profile <name>]
claude: /hx-review
codex: hx-review
---

# Phase 05 · 代码审查

参数: `$ARGUMENTS`（可选: `--profile <name>`）

## 执行步骤

1. 解析 Profile：优先 `--profile`，否则读 `.hx/config.yaml` 的 `defaultProfile`
2. 加载前置 Hook（`review-pre.md`，存在则作为额外审查维度注入）
3. 获取当前变更 diff：运行 `git diff HEAD`（若无暂存则 `git diff`）
4. 读取 profile 的 `review-checklist.md`，若有平台附加检查追加 `reviewExtra` 内容
5. 逐项对照 checklist 审查 diff：
   - 架构层级依赖是否合规
   - 错误处理是否遵循 golden-rules
   - 禁止项（console.log、裸 throw、any 类型等）
   - 测试覆盖率是否足够
   - 其他 checklist 条目
6. 输出每项审查结果（✓ / ✗ / ⚠ 警告）
7. 汇总：通过项数 / 总项数，列出需修复的问题
8. 加载后置 Hook 并执行（`review-post.md`）

## Hook 路径

- `~/.hx/hooks/review-pre.md` / `.hx/hooks/review-pre.md`
- `~/.hx/hooks/review-post.md` / `.hx/hooks/review-post.md`
- `.hx/config.yaml` 的 `hooks.review.pre` / `hooks.review.post` 列表
