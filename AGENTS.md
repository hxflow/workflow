# Repository Guidelines

## 项目结构与模块组织

这是一个 Agent Skill 仓库，核心目标是提供 `hx` 工作流框架。主要目录如下：

- `hxflow/SKILL.md`：Skill 入口，路由 `/hx <command>` 到对应命令。
- `hxflow/commands/`：`hx-*` 命令契约文档。
- `hxflow/scripts/tools/`：事实工具脚本，AI 调用获取结构化数据。
- `hxflow/templates/`：规则模板与默认配置。
- `hxflow/scripts/lib/`：共享工具库。
- `tests/unit/`、`tests/integration/`：单元测试与集成测试。
- `docs/`、`assets/`：设计文档、引导页与静态资源。

## 构建、测试与开发命令

- `bun install`：安装依赖。
- `npm run hx:test`：运行全量测试。
- `npm run hx:test:unit`：仅跑 `tests/unit`。
- `npm run hx:test:integration`：仅跑 `tests/integration`。
- `npm run pack:dry-run`：检查发包内容是否完整。

## 编码风格与命名约定

统一使用 2 空格缩进、ES Module `import`、保留现有无分号风格。TypeScript 开启 `strict`，新增代码不要引入 `any`、隐式返回或未检查索引访问。源码路径优先使用 `@/` 指向 `src/*`。命令文档命名保持 `hx-*.md`，测试文件命名使用 `*.test.ts`、`*.spec.ts`。`src/` 中禁止 `console.log`，CLI 脚本或测试例外；不要直接 `throw new Error(...)`，遵循仓库规则改用统一错误模型。

## 测试要求

测试框架为 Bun test（`bun test`），Bun 运行时执行；不要再用 Vitest 配置或 API。新增逻辑优先补对应单元测试（`tests/unit/*.test.ts`）；涉及安装、命令解析或目录写入的改动，再补集成测试（`tests/integration/*.test.ts`）。

## 提交与 Pull Request 规范

提交历史采用 Conventional Commits，例如 `feat!: ...`、`refactor: ...`、`docs: ...`、`chore: ...`。建议一条提交只表达一个清晰变更。PR 至少包含：变更目的、影响范围、测试命令与结果；如果改动了命令契约、模板或安装行为，补充示例路径或终端输出，便于审阅者快速复现。

## 配置与安全提示

不要提交真实密钥、用户目录下的私有配置或本机路径快照。涉及 `~/.hx`、`~/.claude`、`~/.codex` 的逻辑时，只描述结构和用途，不写入个人凭据。

## Prompt 写作规范

仓库内的命令契约、模板文案和 Agent prompt 统一采用简洁风格：先写目标，再写边界，最后写输出要求，避免长段背景铺垫。优先使用短句、动词开头和可执行表述，例如“扫描项目并生成 `.hx/config.yaml`”，不要写成宽泛口号。单个要点尽量只表达一个约束；能用 3 条说清的内容，不要扩成 8 条。示例、路径和命令保留，重复解释、情绪化措辞和空泛形容词删除。

- 先想清楚再执行：有前提假设就显式写出；存在多种合理解释时，不要静默选一种。
- 简单优先：只写完成当前目标所需的最小约束，不为一次性场景预埋扩展、抽象或配置。
- 外科手术式改动：只保留和当前目标直接相关的规则；脚本、schema、模板已固化的事实不要重复。
- 目标可验证：步骤和输出要能被检查，避免“处理一下”“看情况调整”这类不可验证表述。

## Agent 运行与观察

- 后台 agent 用 `list_agents` 查看实例，用 `read_agent` 读取结果；只有 agent 进入 idle、明确等待后续输入时才用 `write_agent`
- 后台 shell 用 `list_bash` / `read_bash` / `write_bash`；不要把 agent 读写接口和 bash 会话接口混用
- 需要拿长任务结果时，优先读取已存在的后台 agent 或 shell；不要为同一任务重复启动第二个实例

<!-- hx:guide:start -->
## HX Guide

- 项目初始化入口：`.hx/config.yaml`
- 源码路径模板：`src`
- 需求文档模板：`docs/requirement/{feature}.md`
- 计划文档模板：`docs/plans/{feature}.md`
- 进度文件模板：`docs/plans/{feature}-progress.json`
- 当前质量门：`test = npm run hx:test`
- 当前未配置质量门：`lint`、`build`、`type`
- `CLAUDE.md` 当前是到本文件的软链，项目级规则以本文件为准
<!-- hx:guide:end -->

<!-- hx:self-hosting:start -->
## HX Self-Hosting Constraints

- 先区分两层：`src/*` 是框架定义，`.hx/*` 是当前仓库作为使用者的落地结果。
- 改命令行为、运行时规则、默认骨架时，优先修改 `hxflow/commands/*`、`hxflow/scripts/*`、`hxflow/templates/*`，不要把 `.hx/*` 当成事实源。
- `.hx/config.yaml`、`.hx/rules/*`、`.hx/pipelines/*` 只用于验证 `hx-init` 的落地效果；若要调整默认值或模板，回到框架层修改。
- 任何影响 `hx-init`、规则模板、pipeline 或命令契约的改动，都必须同时检查当前仓库 `.hx/*` 的生成结果是否仍与设计一致。
- 文档、命令契约、模板三者必须同步收口；不能只改其中一层而让 self-hosting 结果漂移。
- 将当前仓库视为 `hxflow` 的第一验收用例：如果新流程不能在本仓库顺畅运行，优先视为框架设计未收口。
<!-- hx:self-hosting:end -->
