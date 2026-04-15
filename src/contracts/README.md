# Shared Contracts

- 框架级共享契约目录。
- `src/commands/` 只放命令正文；跨命令规则统一放在本目录。

## 推荐阅读顺序

1. `runtime-contract.md`
2. `command-contract.md`
3. 按需阅读 `feature-contract.md` / `progress-contract.md` / `pipeline-contract.md`
4. 需要查看命令写权时阅读 `ownership-contract.md`

## 文件说明

- `runtime-contract.md`：入口规则与读取顺序。
- `command-contract.md`：命令 frontmatter、正文结构、参数对象与结构化结果。
- `feature-contract.md`：`feature` 的命名、复用、解析与续接契约。
- `progress-contract.md`：`progress.json` 的结构、状态机与调度契约。
- `pipeline-contract.md`：pipeline YAML 的结构与恢复锚点语义。
- `ownership-contract.md`：`feature` / `progress` 等核心事实对象的写权边界。
- `checkpoint-contract.md`：checkpoint 评审机制。
