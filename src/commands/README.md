# Workflow Skill Contracts

- 这里是工作流 skill 契约目录，也是 frontmatter 的公共约定。
- skill 是否可覆盖、是否支持 Hook，不应靠正文约定判断，而应以前置元数据为准。

## 标准字段

- `name`
- `description`
- `usage`

## 框架私有字段

### `protected`

- 类型：`boolean`
- 作用：标记该命令是否为框架锁定命令
- `protected: true` 表示：
  - 不允许用户层 `~/.hx/commands/` 覆盖
  - 不允许项目层 `.hx/commands/` 覆盖
- 缺失时等同于 `false`

### `hooks`

- 类型：`string[]`
- 可选值：`pre`、`post`
- 作用：声明该命令是否支持 Hook，以及支持哪些阶段
- 约定：
  - `hooks: [pre, post]` 表示同时支持前置和后置 Hook
  - `hooks: [pre]` 表示只支持前置 Hook
  - `hooks: [post]` 表示只支持后置 Hook
  - 缺失时等同于不支持 Hook

## 说明

- `protected` 和 `hooks` 都是框架私有字段。
- skill 三层覆盖顺序、`protected` 的运行时解析方式，以及 agent 适配层职责见 `src/commands/resolution.md`。
- Hook 文件命名、查找顺序和加载规则见 `src/hooks/README.md`。
- 若要调整私有字段语义，应优先修改这份公共约定，再同步修改消费逻辑。
