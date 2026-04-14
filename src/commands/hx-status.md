---
name: hx-status
description: 查看任务进度
usage: bun src/tools/status.ts [<feature> | --feature <name>]
protected: true
---

# 查看任务进度

## 目标

- 展示当前 feature 或全部 feature 的进度摘要，并给出下一步动作。

## 何时使用

- 适用场景：想确认当前执行到哪一步，或排查哪个 feature 还没完成。
- 不适用场景：要真正继续执行任务时，直接用 `bun src/tools/run.ts`。

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

- 输出指定或全部 feature 的进度摘要。
- 输出下一步最推荐执行的命令。

## 失败边界

- 目标 `progressFile` 缺失、不可解析，或无法定位指定 feature。

## 下一步

- 存在未完成任务时运行 `bun src/tools/run.ts <feature>`；全部完成时运行 `bun src/tools/check.ts` 或 `bun src/tools/mr.ts`。

## 约束

- 下一步提示直接给出可执行命令
