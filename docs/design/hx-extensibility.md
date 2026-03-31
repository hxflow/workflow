# hx 可扩展性设计

> 状态：部分已实现
> 日期：2026-03-30
> 类型：实现对齐文档

---

## 目标

当前项目的扩展性目标是：

- 让项目保留自己的目录结构和文档路径
- 让用户或项目可以覆盖默认命令与流水线
- 让规则生成尽量依赖项目现状，而不是要求项目适配框架内部约定

这套能力已经落到三层结构与项目初始化机制中，而不是额外的执行引擎。

---

## 当前可扩展层

### Layer 1 · 路径模板

路径模板通过 `.hx/config.yaml` 的 `paths.*` 配置控制：

- `paths.src`
- `paths.requirementDoc`
- `paths.planDoc`
- `paths.progressFile`

当前行为：

- `hx-init` 会扫描项目并写入默认值
- 若项目已有配置，则只补全缺失字段
- 默认模板会根据现有目录信号在 `docs/requirement`、`docs/req`、`workflow/requirements` 等路径间做保守选择

### Layer 2 · 规则文件

规则文件位于 `.hx/rules/`，由 `hx-init` 与 `hx-rules update` 统一管理。

扩展方式：

- 自动区由脚本生成
- 人工区由项目长期维护

这保证了项目可以在不改脚本的前提下沉淀自己的长期规则。

### Layer 3 · Hook 扩展

项目级 Hook 放在：

- `.hx/hooks/`

Hook 不走 `.hx/config.yaml` 配置项，而是按固定命名规则和命令 frontmatter 启用。

- `pre_<command>.md`
- `post_<command>.md`

Hook 不采用覆盖规则，而采用中间件链规则：

- `pre_*`：框架层 → 用户层 → 项目层
- `post_*`：项目层 → 用户层 → 框架层

这样可以让通用能力、个人偏好和项目业务定制同时生效。

### Layer 4 · 命令覆写

命令覆写采用三层优先级：

```text
<project>/.hx/commands/<cmd>.md
~/.hx/commands/<cmd>.md
<frameworkRoot>/src/commands/<cmd>.md
```

当前实现：

- skill 入口由 `hx setup` 生成
- Claude 与 Codex 都通过同一套 skill 契约路由
- 项目可以直接放同名 skill 覆盖框架默认行为

### Layer 5 · Pipeline 覆写

流水线同样采用三层优先级：

```text
<project>/.hx/pipelines/<name>.yaml
~/.hx/pipelines/<name>.yaml
<frameworkRoot>/pipelines/<name>.yaml
```

当前默认流水线定义位于：

- `src/pipelines/default.yaml`

`hx-go` 只按 pipeline 做调度，不额外引入新的执行语法。

---

## 当前已实现能力

当前仓库已经具备：

- 项目初始化契约：`src/commands/hx-init.md`
- 规则刷新契约：`src/commands/hx-rules.md`
- 全局安装与 skill 入口生成：`src/scripts/hx-setup.js`
- skill 契约入口：`src/commands/hx-*.md`
- 默认流水线：`src/pipelines/default.yaml`

---

## 当前未实现能力

以下扩展点仍属于后续能力，不应在文档中表述为已支持：

- 自定义 task id 规则
- 关闭 progress 文件的纯任务文档模式
- 更复杂的 pipeline 语法，例如 `foreach`
- 规则片段的共享包编译
- 项目外部规则仓库的同步、安装、启停

---

## 设计边界

为避免项目扩展能力反向膨胀，当前设计坚持以下边界：

- 不增加新的运行时配置模型
- 不引入额外的项目扫描脚本链
- 不让外部共享能力在运行时直接参与决策
- 不让命令执行逻辑依赖网络状态

扩展只通过项目本地事实体现：

- `.hx/config.yaml`
- `.hx/rules/*.md`
- `.hx/hooks/`
- `.hx/commands/`
- `.hx/pipelines/`

---

## 结论

当前项目的可扩展性已经不依赖复杂执行器，而是依赖：

- 初始化阶段把项目现状写成固定事实
- 运行时只读取这些事实
- 用户层与项目层通过标准目录覆盖框架默认值

后续若继续增强，也应沿着这条路径扩展，而不是引入新的运行时抽象。
