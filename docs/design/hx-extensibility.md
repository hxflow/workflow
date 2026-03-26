# hx 可扩展性设计文档

> 状态：部分已实现（AI-first 重构后方案有调整）
> 原始日期：2026-03-25 · 更新：2026-03-26

---

## 背景与目标

hx 目前是「框架驱动用户」——用户必须按 hx 的目录结构、文档格式、命令顺序来。

目标改为「框架适配用户」——用户已有的文档体系、命令习惯、工作流程，hx 去适配。

### 典型迁移场景

- Go 后端团队，已有完善的 Skill-based 工作流
- 任务单格式：`业务线/香港/需求/<需求>/任务/TS-46852-<名>/任务执行.md`（需求 + 计划 + 测试用例三合一）
- 18 个自定义 Skill 覆盖完整开发链路
- DevOps 任务 ID 格式：`TS-\d+`，非 hx 默认的 `TASK-XX-NN`

最小迁移成本：只需新建 `.hx/config.yaml` + `.hx/profiles/go-ddd/`，不改现有目录结构和 Skill。

---

## 架构调整说明（AI-first 重构）

原设计依赖 CLI 脚本处理路径解析、命令覆写、流水线执行。
重构后改为 **Claude-as-executor 模式**：路径解析、命令路由、流水线执行全部由 Claude 在运行时完成，无需对应的 JS 实现。

| 原设计 | 实际实现 |
|--------|---------|
| `path-pattern.js` 路径解析 | Claude 读取 `paths.*` 模板，运行时替换变量 |
| `command-resolver.js` 命令覆写链 | 转发器（`~/.claude/commands/hx-*.md`）三层路由 |
| `yaml-executor.js` + `hx-pipeline.js` | `/hx-go` + `src/pipelines/default.yaml` |
| `next-step-resolver.js` 下一步提示 | 内联在各 `/hx-*` Claude 命令中 |
| `hx-agent-run.js`、`hx-new-doc.js` 等 CLI 脚本 | 删除，由 Claude 命令直接执行 |

---

## Layer 1 · paths 路径配置 ✅ 已实现

### 实现方式

路径配置字段写入 `.hx/config.yaml`，Claude 命令运行时读取并替换 `{feature}`、`{taskId}` 占位符。

```yaml
# .hx/config.yaml
defaultProfile: go-ddd
paths:
  requirementDoc: 业务线/香港/需求/{feature}/资料/需求.md
  planDoc: 业务线/香港/需求/{feature}/任务/{taskId}/任务执行.md
  progressFile: 业务线/香港/需求/{feature}/progress.json
  taskDoc: 业务线/香港/需求/{feature}/任务/{taskId}/任务执行.md  # 可选
  src: src
```

### 路径模板变量

| 变量 | 来源 |
|---|---|
| `{feature}` | 当前需求的内部 `feature key` |
| `{taskId}` | 当前任务的 `task id` |

### `/hx-init` 自动推断

`/hx-init` 会扫描项目目录，自动检测现有文档路径模式并写入非默认值。与默认值相同的字段不写入，保持配置简洁。

### 待完善

- `profile.yaml` 中的 `task_id_format`（自定义任务 ID 格式，如 `TS-\d+`）还未支持
- `progress_tracking: false` 模式（完全依赖 taskDoc，不生成 progress.json）还未支持

---

## Layer 2 · 命令增强

### 2a · 下一步提示 ✅ 已实现

各 `/hx-*` Claude 命令完成后内联输出下一步提示，例如：

```
✓ /hx-doc user-login 完成
  <requirementDoc for user-login>

下一步：/hx-plan user-login --profile go-ddd
```

无需独立的 `next-step-resolver.js`，Claude 命令自行处理。

### 2b · /hx-status ✅ 已实现

查看任务进度的 Claude 命令，支持无参数（汇总所有 feature）和指定 feature（列出详细任务状态）。

```
── user-login ──────────────────────────────
   [████████░░]  4/5 完成
   下一个: TASK-BE-05 — 集成测试

下一步: /hx-run user-login --profile go-ddd
```

实体文件：`src/agents/commands/hx-status.md`

---

## Layer 3 · 三层命令覆写 ✅ 已实现

### 实现方式

转发器文件 (`~/.claude/commands/hx-*.md`) 按优先级路由到实体命令文件：

```
<project>/.hx/commands/<cmd>.md   ← 项目级（最高优先级）
~/.hx/commands/<cmd>.md           ← 用户级
<frameworkRoot>/agents/commands/<cmd>.md  ← 系统层（兜底）
```

转发器由 `hx setup` 生成，内容固定，升级只需 `git pull` + 重新生成转发器，用户层和项目层覆盖不受影响。

### 与原设计的差异

原设计是 YAML 格式的命令覆写（需要 `yaml-executor.js`）。
实际实现是 Markdown 格式的 Claude 指令覆写，更灵活，无需引擎。

---

## Layer 4 · Pipeline 编排 ✅ 已实现

### 实现方式

`/hx-go` 读取 pipeline YAML 按步骤驱动执行，YAML 同样支持三层覆写：

```
<project>/.hx/pipelines/default.yaml   ← 项目级
~/.hx/pipelines/default.yaml           ← 用户级
<frameworkRoot>/pipelines/default.yaml ← 系统层
```

### 系统默认流水线（src/pipelines/default.yaml）

8 个步骤：doc → plan → ctx → run → review → qa → clean → mr

支持：
- `checkpoint`：执行后暂停，等用户确认继续
- `on_fail: stop`：失败时终止流水线
- `--from <step-id>`：从指定步骤恢复（断点续跑）

### 与原设计的差异

原设计有更复杂的 `foreach`、`when`、`$var` 替换、状态持久化等机制。
当前实现聚焦核心场景（顺序执行 + checkpoint + 断点恢复），足够覆盖标准交付流程。

---

## 待实现

### P1 · task_id_format + progress_tracking: false

支持自定义任务 ID 格式（如 `TS-\d+`）和纯 taskDoc 模式（不生成 progress.json）。
适用场景：直接对接 DevOps 任务号，不需要 hx 维护独立进度文件。

### P2 · profile.yaml 中的 workflow 字段

允许在 profile 中定义默认工作流序列，覆盖 pipeline 的默认步骤顺序。
适用场景：某个团队的流程有特定的跳步或自定义阶段。

### P3 · Pipeline foreach 支持

`foreach: pendingTasks` 让 run 步骤自动遍历所有 pending 任务。
当前 `/hx-run` 默认已实现类似能力，但未集成到 pipeline YAML 语法中。

---

## 当前文件结构

```
src/agents/commands/hx-*.md     工作流 Claude 命令实体
src/pipelines/default.yaml      默认流水线定义
src/profiles/base/profile.yaml  内置基础 Profile
src/scripts/lib/profile-utils.js  Profile 加载 + paths 合并
src/scripts/lib/resolve-context.js  路径常量 + 项目根查找
src/scripts/lib/install-utils.js    转发器生成
src/scripts/hx-setup.js         全局安装
src/scripts/hx-upgrade.js       升级（git pull + 重新生成转发器）
src/scripts/hx-uninstall.js     卸载
src/scripts/hx-doctor.js        健康检测
```
