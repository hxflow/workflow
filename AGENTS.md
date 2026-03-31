# Repository Guidelines

## 项目结构与模块组织

这是一个 Node.js + ESM 的 CLI 仓库，核心目标是提供 `@hxflow/cli` 工作流框架。主要目录如下：

- `bin/hx.js`：CLI 入口，只直接处理 `hx setup`、`hx version`。
- `src/commands/`：`hx-*` 命令契约文档与解析规则。
- `src/scripts/`：安装、setup、上下文解析等实际脚本实现。
- `src/templates/`：规则模板、forwarder 模板与默认配置。
- `src/hooks/`、`src/pipelines/`：Hook 与流水线内置定义。
- `tests/unit/`、`tests/integration/`：单元测试与集成测试。
- `docs/`、`assets/`：设计文档、引导页与静态资源。

## 构建、测试与开发命令

- `npm install`：安装依赖。
- `node src/scripts/hx-setup.js`：手动执行 setup，初始化或修复全局安装产物。
- `node bin/hx.js --help`：查看 CLI 当前行为与命令契约入口。
- `npm run hx:test`：运行全量 Vitest 测试。
- `npm run hx:test:unit`：仅跑 `tests/unit`。
- `npm run hx:test:integration`：仅跑 `tests/integration`。
- `npm run pack:dry-run`：检查 npm 发包内容是否完整。

## 编码风格与命名约定

统一使用 2 空格缩进、ES Module `import`、保留现有无分号风格。TypeScript 开启 `strict`，新增代码不要引入 `any`、隐式返回或未检查索引访问。源码路径优先使用 `@/` 指向 `src/*`。命令文档命名保持 `hx-*.md`，测试文件命名使用 `*.test.ts`、`*.spec.ts`。`src/` 中禁止 `console.log`，CLI 脚本或测试例外；不要直接 `throw new Error(...)`，遵循仓库规则改用统一错误模型。

## 测试要求

测试框架为 Vitest，Node 环境运行。新增逻辑优先补对应单元测试；涉及安装、命令解析或目录写入的改动，再补集成测试。覆盖率由 `vitest.config.ts` 控制，其中 `src/service` 目录阈值为 statements/functions/lines 80%、branches 75%；即使当前目录未出现，也不要降低该基线。

## 提交与 Pull Request 规范

提交历史采用 Conventional Commits，例如 `feat!: ...`、`refactor: ...`、`docs: ...`、`chore: ...`。建议一条提交只表达一个清晰变更。PR 至少包含：变更目的、影响范围、测试命令与结果；如果改动了命令契约、模板或安装行为，补充示例路径或终端输出，便于审阅者快速复现。

## 配置与安全提示

不要提交真实密钥、用户目录下的私有配置或本机路径快照。涉及 `~/.hx`、`~/.claude`、`~/.codex` 的逻辑时，只描述结构和用途，不写入个人凭据。

## Prompt 写作规范

仓库内的命令契约、模板文案和 Agent prompt 统一采用简洁风格：先写目标，再写边界，最后写输出要求，避免长段背景铺垫。优先使用短句、动词开头和可执行表述，例如“扫描项目并生成 `.hx/config.yaml`”，不要写成宽泛口号。单个要点尽量只表达一个约束；能用 3 条说清的内容，不要扩成 8 条。示例、路径和命令保留，重复解释、情绪化措辞和空泛形容词删除。
