# 初始化项目

## 执行步骤

1. 执行 `hx-init`，完成当前目录或指定目录的初始化。

生成产物：`.hx/config.yaml`（或 `workspace.yaml`）、`.hx/rules/*.md`、`.hx/pipelines/default.yaml`。

## 约束

- 幂等：已存在的文件不覆盖，只补全缺失部分
- 多项目根目录初始化为 workspace，单项目目录初始化为 project
- `.hx/workspace.yaml` 与 `.hx/config.yaml` 不允许在同一目录并存
- 不做项目分析，只生成配置骨架
