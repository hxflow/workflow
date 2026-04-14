# Progress Contract

`progress.json` 是框架内的固定数据结构。

- 顶层字段集合固定
- `lastRun` 字段集合固定
- `tasks[]` 字段集合固定
- 不允许出现未在本文档声明的额外字段
- schema：`src/templates/progress.schema.json`
- 模板：`src/templates/progress.json`
- 运行时校验入口：`src/scripts/lib/progress-schema.ts`

## 目标

- `progress.json` 是单个 `feature` 的结构化执行状态文件。
- 只承载需求归属、task 状态、依赖与并行调度元数据。
- 不是计划正文，不承载长篇实施说明。

## 文件路径

- 活跃路径：`docs/plans/{feature}-progress.json`
- 归档路径：`docs/archive/{feature}/{feature}-progress.json`
- 一个 `feature` 对应一个 `progress.json`
- `hx-mr` 完成后文件从活跃路径移至归档路径；`hx-run` 定位失败时自动从归档路径还原至活跃路径

## 标准结构

结构详见 `src/templates/progress.json` 与 `src/templates/progress.schema.json`。

## 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `feature` | `string` | 是 | 当前需求标识 |
| `requirementDoc` | `string` | 是 | 需求文档相对路径 |
| `planDoc` | `string` | 是 | 计划文档相对路径 |
| `createdAt` | `string` | 是 | 首次生成时间，ISO 8601 |
| `updatedAt` | `string` | 是 | 最近一次回写时间，ISO 8601 |
| `completedAt` | `string \| null` | 是 | 当前需求全部 task 完成时间 |
| `lastRun` | `object \| null` | 是 | 最近一次执行的 task 信息 |
| `tasks` | `array` | 是 | 当前 feature 的 task 列表 |

顶层只允许出现以上 8 个字段。

## lastRun

`lastRun` 只有两种合法形态：`"lastRun": null`（未执行过）或固定 6 字段对象（已执行过至少一个 task）。其他取值视为非法。

示例：`{"taskId": "TASK-BE-01", "taskName": "...", "status": "done", "exitStatus": "succeeded", "exitReason": "", "ranAt": "..."}`

### 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | `string` | 是 | 最近一次运行的 task ID |
| `taskName` | `string` | 是 | 最近一次运行的 task 名称 |
| `status` | `string` | 是 | 本次运行结束后的 task 状态，只允许 `in-progress` 或 `done` |
| `exitStatus` | `string` | 是 | 本次执行的退出状态 |
| `exitReason` | `string` | 是 | 本次执行退出原因；成功时可为空字符串 |
| `ranAt` | `string` | 是 | 最近一次运行时间，ISO 8601 |

`lastRun` 规则：

- `lastRun = null` 表示当前 feature 还没有任何 task 被执行过
- `lastRun` 一旦非空，必须完整包含以上 6 个字段
- `lastRun` 不允许保留半结构，例如只写 `taskId`
- `lastRun` 不允许附带额外字段，例如 `durationSeconds`、`output`

### exitStatus 枚举

```text
succeeded
failed
aborted
blocked
timeout
```

### exitReason 规则

- `exitReason` 类型固定为 `string`
- `exitStatus = succeeded` 时允许为空字符串
- `exitStatus != succeeded` 时必须为非空字符串
- `exitReason` 必须描述本次未完成或异常退出的直接原因

### 一致性

- `lastRun.taskId` 必须能在 `tasks[]` 中找到
- `lastRun.taskName` 必须与对应 task 的 `name` 完全一致
- `lastRun.status` 只允许为 `in-progress` 或 `done`，且必须与对应 task 的当前 `status` 一致
- `lastRun.exitStatus = succeeded` 时，对应 task 的 `status` 必须为 `done`
- `lastRun.exitStatus != succeeded` 时，对应 task 的 `status` 必须为 `in-progress`
- `lastRun.ranAt` 必须大于等于对应 task 的 `startedAt`
- 若对应 task 的 `completedAt` 非空，则 `lastRun.ranAt` 必须大于等于该 task 的 `completedAt`

## tasks[]

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | task ID |
| `name` | `string` | 是 | task 名称 |
| `status` | `string` | 是 | task 状态 |
| `dependsOn` | `string[]` | 是 | 前置 task ID 列表；为空表示无依赖 |
| `parallelizable` | `boolean` | 是 | 是否允许与其他可执行 task 并行处理 |
| `output` | `string` | 是 | 执行结果摘要 |
| `startedAt` | `string \| null` | 是 | task 开始时间 |
| `completedAt` | `string \| null` | 是 | task 完成时间 |
| `durationSeconds` | `number \| null` | 是 | task 执行耗时，单位秒 |

每个 `tasks[]` 项只允许出现以上 9 个字段。

## output 字段规范

### 格式约束

- 类型：单行纯文本 `string`，不允许包含 `\n` 或 `\r`
- 最大长度：200 字符
- 内容语言：与项目主语言一致，中文项目使用中文

### 按状态分类的取值规则

| task.status | output 约束 |
|-------------|------------|
| `pending` | 必须为 `""` |
| `in-progress` | 必须为 `""` |
| `done` | 必须为非空字符串，1–200 字符，无换行 |

### 内容要求

`status = done` 时，output 必须覆盖：变更动作、涉及的核心文件或模块（不超过 3 个）、验证结果。

## 状态转移规则

合法路径：`pending → in-progress → done`（唯一合法正向路径，不可逆，不可跳步）。

### hx-run 的两阶段写入要求

两阶段写入通过以下命令执行，不允许 AI 直接修改 progressFile：

- 阶段一：`bun src/tools/progress.ts start <progressFile> <taskId>`
- 阶段二成功：`bun src/tools/progress.ts done <progressFile> <taskId> --output "<摘要>"`
- 阶段二失败：`bun src/tools/progress.ts fail <progressFile> <taskId> --exit <status> --reason "<原因>"`

每次命令执行内部自动调用校验，失败时立即中止并返回错误。

以下为两阶段的字段语义说明（由命令内部保证执行顺序和字段完整性）：

阶段一：

1. 将 `tasks[].status` 改为 `"in-progress"`
2. 写入 `tasks[].startedAt`（当前时刻 ISO 8601）
3. 更新顶层 `updatedAt`
4. 调用 `validateProgressFile` 校验，失败则停止

阶段二：

1. 成功结束时，将 `tasks[].status` 改为 `"done"`，并写入 `tasks[].completedAt`、`tasks[].durationSeconds`、`tasks[].output`
2. 异常退出时，保留 `tasks[].status = "in-progress"`，且不得写入 `tasks[].completedAt`、`tasks[].durationSeconds`、`tasks[].output`
3. 更新顶层 `updatedAt` 和 `lastRun`
4. 全部 task 完成时写入顶层 `completedAt`
5. 调用 `validateProgressFile` 校验，失败则停止

两阶段之间是实际执行任务的时间窗口。任何情况下都不允许在不经过阶段一的情况下直接写入阶段二的字段。

## 调度规则

> **调度和写入操作均通过 `bun src/tools/progress.ts` 系列命令完成。AI 不自行推导调度逻辑，不直接修改 progressFile。**

### 可执行 task 判定

- `status === "pending"`
- `dependsOn` 中列出的 task 全部为 `done`

### 可恢复 task 判定

- `status === "in-progress"`
- `startedAt` 非空
- `completedAt === null`
- `dependsOn` 中列出的 task 全部为 `done`

`recoverable` 表示该 task 在之前的执行中已经进入过阶段一，但在阶段二完成前中断。

### 恢复优先级

1. 先恢复 `recoverable` task
2. 再执行普通 `runnable` 的 `pending` task

若同时存在多个 `recoverable` task：

- 只有当这些 task 同时满足并行条件时才允许并行恢复
- 否则必须串行恢复

### 串行与并行

- 先按依赖关系调度
- 同一依赖层内没有显式并行标记时，按计划顺序串行执行

允许并行的条件：

- 同时存在多个 runnable task
- 这些 task 的 `parallelizable` 全部为 `true`
- 没有额外人工约束要求串行

任一条件不满足时，应回退为串行执行。

### 回退策略

以下情况不允许自动并行：

- task 未声明 `dependsOn`
- task 依赖关系无法解析
- task 之间存在共享改动范围但计划未说明可并行
- 当前执行环境不支持安全并发回写 `progress.json`

### 并行写入隔离规则

并行执行时，多个 agent 各自独立回写 `progress.json`，必须遵守以下约束：

1. 每次写入前都重新读取磁盘上的最新 `progress.json`
2. 每次写入只改写当前 task 对应的 `tasks[i]` 字段，不得修改其他 task 的字段
3. 每次写入均更新顶层 `updatedAt` 和 `lastRun`
4. 多个 task 并行完成时，`lastRun` 以后一次物理写入为准

违反以上规则时，必须回退为串行执行。

## 边界

- 本文件定义 `progress.json` 的结构、不变量、状态机和调度规则。
- 命令写权、初始化职责和运行时回写职责统一由 `src/contracts/ownership-contract.md` 定义。
- `--plan-task` 允许指定 `pending` 或 `in-progress` task，但禁止指定 `done` task
- 若指定的 `--plan-task` 不满足 `recoverable` 或 `runnable` 条件，必须停止并返回原因

## lastRun 回写规则

- 每次 task 执行结束后，必须回写 `lastRun`（成功和异常退出均须更新）
- 回写值必须来自刚刚结束执行的那个 task
- `taskId` 取该 task 的 `id`；`taskName` 取 `name`；`status` 取回写后的最新 `status`；`exitStatus` 取本次执行退出状态；`exitReason` 取退出原因；`ranAt` 取回写时刻（ISO 8601）

并行场景附加约束：

- 并行执行时，每个 agent 都必须在自己的阶段二回写 `lastRun`
- 回写前必须重新读取文件，不得将启动时读取的 `lastRun` 值写回
- 若回写时发现文件中 `lastRun.ranAt` 晚于本次 `ranAt`，仍以本次为准覆盖写入

### hx-run

- 调度前先校验 `requirementDoc`、`planDoc`、`progressFile`、规则文件和 `gates`
- 调度前必须调用：`validateProgressFile(filePath)`、`validateProgressData(data)`
- 校验失败时立即停止，不允许进入后续调度和回写

## 计算规则

- `tasks[].durationSeconds = completedAt - startedAt`
- 顶层 `completedAt` 仅在所有 task 都为 `done` 时写入
- 顶层 `completedAt` 取最后一个完成 task 的 `completedAt`

## 校验规则

- 顶层字段集合必须与模板完全一致
- `tasks` 必须为非空数组
- 每个 `tasks[]` 项的字段集合必须与模板完全一致
- `lastRun` 只能为 `null` 或固定 6 字段对象
- `lastRun.status` 只能是 `in-progress | done`
- `tasks[].status` 只能是 `pending | in-progress | done`
- `tasks[].dependsOn` 中的每个 ID 都必须存在于同一文件的 `tasks[]`
- task 不允许依赖自己
- task 依赖图不允许循环
- `lastRun.taskId` 必须能在 `tasks[]` 中找到
- `lastRun.taskName` 必须与对应 task 的 `name` 一致
- `lastRun.status` 必须与对应 task 的 `status` 一致
- `lastRun.exitStatus` 必须是 `succeeded | failed | aborted | blocked | timeout`
- `lastRun.exitReason` 在 `exitStatus != succeeded` 时必须为非空字符串
- `lastRun.exitStatus != succeeded` 时，对应 task 必须保持 `in-progress`
- `status = done` 时，`startedAt`、`completedAt`、`durationSeconds` 应非空
- 存在未完成 task 时，顶层 `completedAt` 必须为 `null`
