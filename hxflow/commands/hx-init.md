# 初始化项目规则事实

## 执行步骤

1. 执行 `bun scripts/tools/init.ts`，直接完成当前目录或指定目录的初始化阶段。

## 约束

- 只做初始化，不补充项目分析
- 多项目根目录初始化为 workspace，单项目目录初始化为 project
- `.hx/workspace.yaml` 与 `.hx/config.yaml` 不允许在同一目录并存
