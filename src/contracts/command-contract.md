# Command Contract

- 定义所有 `hx-*` 命令正文的公共写法。
- `src/commands/` 只放命令特有内容。
- 运行时解析、命令写权和对象 schema 不在本文定义。

## Frontmatter

- `name`
- `description`
- `usage`

## 正文结构

- 每个 `hx-*` 命令统一使用以下章节顺序：
  - `## 目标`
  - `## 何时使用`
  - `## 输入`
  - `## 执行步骤`
  - `## 成功结果`
  - `## 失败边界`
  - `## 下一步`
  - `## 失败处理`（仅在需要单独列出失败分支时出现）
  - `## 约束`
- `## 输入` 固定包含：`命令参数`、`必选参数`、`可选参数`、`默认值`、`依赖输入`
- `命令参数` 只描述 CLI 可见参数模型，不写自由叙述。
- 共享运行规则、命令写权和对象 schema 不在命令正文重复；只有命令特例才补充。

## 参数对象约定

- 命令运行时的 `arguments` 固定为结构化对象：
  - `raw`：原始参数字符串
  - `positional`：位置参数数组
  - `options`：选项参数对象（key 为选项名，value 为字符串或布尔值）

## 结构化结果

命令脚本（事实工具）统一输出 JSON 到 stdout：

- 成功：`{"ok": true, ...}` + exit 0
- 失败：`{"ok": false, "error": "..."}` + exit 1

AI 根据脚本返回的事实自行推理、分析和生成产物。

### AI 侧结构化结果

AI 完成命令后，向用户汇报的结构化结果使用以下固定字段顺序：
  1. `status`
  2. `command`
  3. `feature`
  4. `summary`
  5. `artifacts`
  6. `issues`
  7. `nextAction`

### `artifacts`

- 类型：`Record<string, unknown>`
- 只承载可复用产物。

### `issues`

- 类型：`Array<{ level: "info" | "warning" | "error"; code: string; message: string }>`
- 即使为空，也必须返回数组
- `level` 只允许 `info`、`warning`、`error`
- `code` 必须稳定、可机读

### `nextAction`

- 类型：`{ command: string | null; reason: string }`
- 即使没有推荐动作，也必须返回对象
- 无推荐命令时，`command = null`
