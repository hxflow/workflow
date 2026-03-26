---
name: hx-qa
description: 质量校验
usage: hx-qa [--profile <name>]
claude: /hx-qa
codex: hx-qa
---

# 质量校验

参数: `$ARGUMENTS`（可选: `--profile <name>`）

## 执行步骤

1. 解析 Profile：优先 `--profile`，否则读 `.hx/config.yaml` 的 `defaultProfile`
   - 按顺序查找：`.hx/profiles/<name>/` → `~/.hx/profiles/<name>/` → 框架内置 `profiles/<name>/`
2. 读取 profile.yaml 中的 `gate_commands`（lint / build / type / test / arch）
3. 过滤掉值为空的步骤
4. 按顺序执行各步骤（使用 Bash 工具在项目根目录运行）：
   - lint → build → type → test → arch
   - 若命令包含占位符（如 `{scheme}`），报错并提示补充参数后停止
   - 任一步骤失败立即停止并报告错误详情
5. 所有步骤通过后输出 `✓ <profile> 质量校验全部通过`

## 输出格式

```
── 质量校验 ──────────────────────────────
→ Step 1/N  lint   ✓ 通过
→ Step 2/N  type   ✓ 通过
→ Step 3/N  test   ✓ 通过

✓ base 质量校验全部通过
```

## 说明

校验命令由项目自定义，在 profile.yaml 的 `gate_commands` 中配置。
框架不预设具体命令，仅按顺序执行并汇报结果。
