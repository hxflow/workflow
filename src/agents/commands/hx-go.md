---
name: hx-go
description: 全自动流水线 · 从需求到交付
usage: hx-go [<feature-key>] [--task <task-id>] [--from <step-id>] --profile <name>
claude: /hx-go
codex: hx-go
---

# 全自动流水线 · 从需求到交付

参数: `$ARGUMENTS`（格式: `[<feature-key>] [--task <task-id>] [--from <step-id>] --profile <name>`）

## 执行步骤

### Step 1: 查找流水线定义

按以下优先级找到第一个存在的文件：

1. `<项目根>/.hx/pipelines/default.yaml`
2. `~/.hx/pipelines/default.yaml`
3. `<frameworkRoot>/pipelines/default.yaml`（`frameworkRoot` 从 `~/.hx/config.yaml` 读取）

若三处均不存在，报错停止：`流水线文件未找到，请运行 hx setup 修复。`

### Step 2: 解析参数

- `<feature-key>` — 当前需求的内部主键；若省略，则优先从当前会话最近一次 `hx-doc` / `hx-plan` 的目标文档自动续接
- `--profile <name>` — profile 名称，透传给每个步骤
- `--task <task-id>` — 仅执行指定任务（仅对 run 步骤生效，作为高级模式）
- `--from <step-id>` — 跳过该步骤之前的所有步骤，从指定步骤开始执行

### Step 3: 逐步执行

读取流水线 YAML 的 `steps` 列表，按顺序执行：

1. 若指定了 `--from <step-id>`，跳过该 step-id 之前的所有步骤
2. 对每个步骤，按以下优先级找到命令文件并读取其完整内容作为指令执行：
   - `<项目根>/.hx/commands/<command>.md`
   - `~/.hx/commands/<command>.md`
   - `<frameworkRoot>/agents/commands/<command>.md`
3. 执行时透传 `<feature-key>`、`--profile`、`--task` 等参数；`run` 步骤默认执行整个 feature，只有传 `--task` 时才下钻到单任务
4. 若步骤定义了 `checkpoint`，执行完毕后暂停，展示结果，等待用户确认后再继续
5. 若步骤定义了 `on_fail: stop`，执行失败时立即停止整个流水线并报告

## 事实来源

- `~/.hx/config.yaml`（`frameworkRoot`）
- `.hx/config.yaml`（三层合并：项目层 > 用户层 > 系统默认）
- 流水线定义：`.hx/pipelines/default.yaml` → `~/.hx/pipelines/default.yaml` → `<frameworkRoot>/pipelines/default.yaml`
- 当前 Profile（`.hx/profiles/` → `~/.hx/profiles/` → 框架内置 `profiles/`）
