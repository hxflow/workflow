---
name: hx-clean
description: Phase 07 · 工程清理扫描
usage: hx-clean [--profile <name>]
claude: /hx-clean
codex: hx-clean
---

# Phase 07 · 工程清理扫描

参数: `$ARGUMENTS`（可选: `--profile <name>`）

## 执行步骤

1. 解析 Profile：优先 `--profile`，否则读 `.hx/config.yaml` 的 `defaultProfile`
2. 加载前置 Hook（`clean-pre.md`，存在则作为额外扫描规则注入）
3. 扫描 `src/` 目录（排除测试文件）：

   **代码质量问题：**
   - `console.log / warn / error / debug / info`（禁止进 src/）
   - `throw new Error(...)`（应使用 AppError）
   - `: any`（类型逃逸）
   - 可疑类型断言（`as unknown as`、双重断言）
   - 空 `catch` 块
   - `TODO / FIXME / HACK / XXX` 注释
   - 魔法数字（未命名的字面量）
   - 未处理的 `new Promise`

4. 检查文档一致性：
   - `paths.progressFile` 模板匹配的进度文件是否都有对应需求文档
   - `paths.progressFile` 模板匹配的进度文件中 done 的任务数与实际代码是否匹配
5. 如果 profile.yaml 定义了 `cleanChecks`，执行额外专项检查
6. 加载后置 Hook 并执行（`clean-post.md`）
7. 输出报告：按类别分组，列出文件路径和行号，汇总问题总数

## Hook 路径

- `~/.hx/hooks/clean-pre.md` / `.hx/hooks/clean-pre.md`
- `~/.hx/hooks/clean-post.md` / `.hx/hooks/clean-post.md`
- `.hx/config.yaml` 的 `hooks.clean.pre` / `hooks.clean.post` 列表
