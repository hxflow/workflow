---
name: hx-status
description: 查看任务进度
usage: bun src/tools/status.ts [<feature> | --feature <name>]
---

# 查看任务进度

## 目标

展示当前或全部 feature 的进度摘要，给出下一步动作。

## 何时使用

- 确认当前执行到哪一步，或排查哪个 feature 未完成。
- 要继续执行任务时直接用 `bun src/tools/run.ts`。

## 输入

- 命令参数：`$ARGUMENTS`
- 必选参数：无
- 可选参数：`<feature>`、`--feature <name>`
- 默认值：未传参数时扫描全部进度文件
- 依赖输入：`paths.progressFile` 指向的进度文件集合

## 执行步骤

1. 解析参数，确定目标 feature（positional 或 `--feature`）。
2. 调用 `bun src/tools/status.ts [<feature>]`，输出进度摘要和下一步建议。

## 成功结果

- 输出指定或全部 feature 的进度摘要和推荐的下一步命令。

## 失败边界

- 进度文件缺失、不可解析，或无法定位指定 feature。

## 下一步

- 存在未完成任务时运行 `bun src/tools/run.ts <feature>`；全部完成时运行 `bun src/tools/check.ts`。

## 约束

- 下一步提示直接给出可执行命令
