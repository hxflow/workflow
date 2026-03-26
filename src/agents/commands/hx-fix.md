---
name: hx-fix
description: Phase 05 · 修复错误
usage: hx-fix [--profile <name>] [--log <text>] [--file <path>]
claude: /hx-fix
codex: hx-fix
---

# Phase 05 · 修复错误

参数: `$ARGUMENTS`（格式: `[--profile <name>] [--log <text>] [--file <path>]`）

## 执行步骤

1. 解析 Profile：优先 `--profile`，否则读 `.hx/config.yaml` 的 `defaultProfile`
2. 加载前置 Hook（`fix-pre.md`，存在则作为修复约束注入）
3. 获取错误上下文（优先级从高到低）：
   - `--file <path>`：读取指定文件中的错误日志
   - `--log <text>`：使用提供的文本作为错误信息
   - 自动运行 profile 的 `test` 命令并截取失败输出
4. 读取以下约束文件：
   - base profile 的 `golden-rules.md`
   - profile 的 `golden-rules.md`
5. 根据错误定位相关源文件并直接修复
6. 运行 `hx-qa` 验证质量校验全部通过
7. 加载后置 Hook 并执行（`fix-post.md`）

## 修复约束

- 不修改已有函数签名（参数与返回类型）
- 不修改现有测试的期望值（测试是行为契约）
- 修复后补充一个能复现此 Bug 的回归测试
- 错误处理遵循 base/team golden-rules

## Hook 路径

- `~/.hx/hooks/fix-pre.md` / `.hx/hooks/fix-pre.md`
- `~/.hx/hooks/fix-post.md` / `.hx/hooks/fix-post.md`
- `.hx/config.yaml` 的 `hooks.fix.pre` / `hooks.fix.post` 列表
