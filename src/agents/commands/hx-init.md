---
name: hx-init
description: 初始化项目
usage: hx-init [--profile <name>]
claude: /hx-init
codex: hx-init
---

# 初始化项目

参数: `$ARGUMENTS`（可选: `--profile <name>`）

## 执行步骤

### Step 1: 分析项目结构

使用 Glob / Read / Grep 工具直接分析项目，收集：

- **技术栈**：`package.json`、`go.mod`、`pubspec.yaml`、`Podfile` 等依赖文件
- **源码目录**：`src/`、`app/`、`lib/` 等主要目录的层级与命名
- **门控命令**：`package.json` 中的 `scripts`（lint、test、typecheck、build）；Makefile、`go test` 等
- **文档结构**：是否存在 `docs/`、需求文档、执行计划等目录，记录实际路径模式
- **现有配置**：`.hx/config.yaml`、`.hx/commands/`、`.hx/hooks/`、`.hx/pipelines/`、`CLAUDE.md`

### Step 2: 推断 Profile

若 `$ARGUMENTS` 中指定了 `--profile <name>`，直接使用；否则默认使用 `base`。

推荐原则：
- 若项目暂无稳定团队规范，直接使用 `base`
- 若项目已经调教出自己的规则集，使用一个清晰的自定义名称（如 `my-team`、`go-ddd`、`app-shell`）
- 框架不再内置前端/服务端/移动端分类，差异全部下沉到项目自己的 profile

### Step 3: 推断路径配置与样板内容

根据 Step 1 的分析，推断各路径字段。**即使最终采用默认值，也要显式写入配置文件和样板文件，让用户有可修改的模板。**

| 字段 | 默认值 | 检测方式 |
|------|--------|---------|
| `paths.src` | `src` | 实际源码主目录（`app/`、`lib/` 等） |
| `paths.requirementDoc` | `docs/requirement/{feature}.md` | 查找已有需求文档的路径模式，提取表示当前需求内部 `feature key` 的 `{feature}` 占位符位置 |
| `paths.planDoc` | `docs/plans/{feature}.md` | 查找已有执行计划的路径模式 |
| `paths.progressFile` | `docs/plans/{feature}-progress.json` | 与 planDoc 同目录时无需写入 |
| `paths.taskDoc` | 无默认（可选） | 若存在按 feature/taskId 两级组织的任务文档目录则写入 |

**路径模式识别方法：**
- 用 Glob 查找已有文档（如 `docs/**/*.md`、`**/需求/**/*.md`）
- 若发现类似 `业务线/香港/需求/user-login/` 这样的结构，提取模板：`业务线/香港/需求/{feature}/`，其中 `{feature}` 代表当前需求的内部 `feature key`
- 若发现任务级文档（如 `.../任务/TASK-01/任务执行.md`），配置 `taskDoc`：`业务线/.../任务/{taskId}/任务执行.md`
- 若项目为空（无现有文档），路径全部使用默认值，并在 `.hx/config.yaml` 中显式写出默认值

同时准备以下样板内容：

- `.hx/config.yaml`：带注释的可编辑配置模板
- `.hx/commands/README.md`：说明如何覆盖内置命令
- `.hx/commands/hx-your-command.md.example`：自定义命令样板
- `.hx/hooks/README.md`：说明 hook 命名和接入方式
- `.hx/hooks/run-pre.md.example` / `.hx/hooks/run-post.md.example`：hook 样板
- `.hx/pipelines/default.yaml`：可编辑的项目级流水线模板

### Step 4: 向用户输出推荐方案

展示以下内容，等待确认（或调整）：

- 推荐的 profile 名称及理由（未指定时默认 `base`）
- 检测到的门控命令（lint / test / type / build）
- 拟写入的 `.hx/config.yaml` 关键字段（即使都是默认值也要展示）
- 将要创建的样板文件列表（commands / hooks / pipelines）
- 若推荐自定义 profile：列出拟写入的 `gate_commands` 和架构路径

### Step 5: 写入

确认后执行以下操作（直接用工具创建文件，目录会自动生成）：

**5a. 写入 `.hx/config.yaml`**。要求：

- 即使全部使用默认值，也要显式写出默认配置
- 文件必须带注释，用户看完就知道如何改 `paths`、`hooks`、`pipelines`
- 若文件已存在，只补充缺失的注释块和字段，不覆盖用户已有值

参考格式：
```yaml
# Harness Workflow 项目级配置
# 即使当前使用默认值，也显式写出，方便后续修改。

defaultProfile: <profile 名称>

# 路径模板。可按项目实际情况修改。
paths:
  src: <实际源码目录，默认 src>
  requirementDoc: <实际值，默认 docs/requirement/{feature}.md>
  planDoc: <实际值，默认 docs/plans/{feature}.md>
  progressFile: <实际值，默认 docs/plans/{feature}-progress.json>
  # taskDoc: <若检测到则写入，否则保留注释示例>

# Hook 配置示例。未启用时保留注释，用户可按需取消注释。
# hooks:
#   doc:
#     pre:
#       - .hx/hooks/doc-pre.md
#     post:
#       - .hx/hooks/doc-post.md
#   run:
#     pre:
#       - .hx/hooks/run-pre.md
#     post:
#       - .hx/hooks/run-post.md
#
# # 如需自定义流水线入口，可覆盖项目级 pipeline 文件。
# pipelines:
#   default: .hx/pipelines/default.yaml
```

**5b. 写入样板文件**。即使当前不打算自定义，也要创建最小样板，让用户知道去哪里改：

- `.hx/commands/README.md`
- `.hx/commands/hx-your-command.md.example`
- `.hx/hooks/README.md`
- `.hx/hooks/run-pre.md.example`
- `.hx/hooks/run-post.md.example`
- `.hx/pipelines/default.yaml`

样板要求：

- 都带注释
- 明确说明查找优先级、命名方式、什么时候该改这个文件
- pipeline 默认内容可以复制当前系统默认流水线，再加注释说明如何改步骤

**5c. 若需要项目级 profile**，写入 `.hx/profiles/<name>/profile.yaml`：
```yaml
extends: base
label: <团队名称>
gate_commands:
  lint: <检测到的 lint 命令>
  test: <检测到的 test 命令>
  type: <检测到的 typecheck 命令>
  build: <检测到的 build 命令>
```
若 `<name>` 为 `base`，则直接更新 `.hx/profiles/base/profile.yaml`；若为其他名称，保留 `extends: base`。

**5d. 在 `CLAUDE.md` 中注入或更新 harness 标记块**

若 `CLAUDE.md` 不存在则创建；若已存在 `<!-- hxflow:start -->` 则替换块内内容。

标记块格式：
```
<!-- hxflow:start -->
## Harness Workflow

本项目已启用 Harness Workflow Framework。

- 配置: `.hx/config.yaml`
- Profile: `<profile 名称>`
- 需求文档: `<requirementDoc 模板中的目录部分>`
- 执行计划: `<planDoc 模板中的目录部分>`

标准命令: `hx-go` `hx-doc` `hx-plan` `hx-run` `hx-review` `hx-qa` `hx-clean` `hx-mr`
<!-- hxflow:end -->
```

## 约束

- 分析阶段使用 Glob / Read / Grep 工具，不调用任何外部命令
- 写入阶段使用 Write / Edit 工具，不调用任何外部命令
- 不要因为“当前使用默认值”而省略配置或样板文件
- `.hx/config.yaml`、样板命令、样板 hook、样板 pipeline 都必须带注释
- 若 `.hx/config.yaml` 或样板文件已存在，优先保留用户已有内容，只补充缺失说明
