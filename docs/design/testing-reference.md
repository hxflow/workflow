# 测试流程参考

> 更新：2026-03-27
> 目标：把当前仓库已经形成的测试分层、执行方式和补测试原则沉淀成可复用参考，避免后续继续靠临时记忆维护。

---

## 1. 当前目标

这套测试不是为了覆盖 Agent 的“真实推理质量”，而是为了稳定以下工程契约：

- CLI 入口和维护命令不回归
- `hx-*` 命令契约的参数、阶段编号、主路径顺序不漂移
- HTML 指南、README 和命令契约保持一致
- 安装产物、三层覆写链路、项目级/用户级回退逻辑可验证
- `hx-init` 的项目脚手架要求不会被无意删掉

---

## 2. 测试分层

### 单元测试

适合验证“稳定文本契约”和“纯函数逻辑”。

- `tests/unit/profile-utils.test.js`
  - 参数解析、profile 加载、YAML 解析、继承与兜底逻辑
- `tests/unit/resolve-context.test.js`
  - 项目根查找、三层 profile 查找根目录
- `tests/unit/install-utils.test.js`
  - forwarder / Codex bundle 生成、命令 frontmatter 解析、安装产物结构
- `tests/unit/pipeline-definition.test.js`
  - 默认 pipeline 的主路径阶段编号
- `tests/unit/plan-utils.test.js`
  - `hx-plan` 命令契约和关键约束
- `tests/unit/workflow-command-contracts.test.js`
  - `hx-doc` / `hx-run` / `hx-mr` 的关键契约
- `tests/unit/hx-init-contract.test.js`
  - `hx-init` 必须产出的脚手架文件与标记块要求
- `tests/unit/docs-guide-consistency.test.js`
  - 关键 HTML 指南与命令契约的一致性

### 集成测试

适合验证“真实 CLI 行为”和“多层配置联动”。

- `tests/integration/cli-entry.test.js`
  - `bin/hx.js` 分发、帮助信息、版本号、未知命令提示
- `tests/integration/cli-maintenance.test.js`
  - `hx setup` / `hx upgrade` / `hx uninstall` / `hx doctor`
- `tests/integration/cli-workflow.test.js`
  - 默认主路径顺序、pipeline checkpoint、workflow 命令存在性
- `tests/integration/fixture-project-smoke.test.js`
  - 使用临时 `HOME` + 临时项目目录，真实跑 `hx setup` / `hx doctor`
  - 验证项目层覆写
  - 验证用户层兜底回退

---

## 3. 日常执行方式

### 全量回归

```bash
./node_modules/.bin/vitest run
```

或：

```bash
npm run hx:test
```

### 只跑单元测试

```bash
npm run hx:test:unit
```

### 只跑集成测试

```bash
npm run hx:test:integration
```

### 改动后建议的最小执行顺序

1. 先跑与改动直接相关的测试文件
2. 通过后跑 `./node_modules/.bin/vitest run`
3. 如果改动涉及安装、路径解析、三层覆写或文档契约，必须补对应测试再结束

---

## 4. 什么时候补哪类测试

### 改了 JS 工具函数

优先补：

- `tests/unit/profile-utils.test.js`
- `tests/unit/resolve-context.test.js`
- `tests/unit/install-utils.test.js`

### 改了 `hx-*.md` 命令契约

优先补：

- `tests/unit/plan-utils.test.js`
- `tests/unit/workflow-command-contracts.test.js`
- `tests/unit/hx-init-contract.test.js`
- `tests/integration/cli-workflow.test.js`

### 改了默认 pipeline

优先补：

- `tests/unit/pipeline-definition.test.js`
- `tests/integration/cli-workflow.test.js`
- 如涉及覆写链路，再看 `tests/integration/fixture-project-smoke.test.js`

### 改了 README / HTML 指南

优先补：

- `tests/unit/docs-guide-consistency.test.js`

### 改了 setup / uninstall / doctor / upgrade

优先补：

- `tests/integration/cli-maintenance.test.js`
- 如涉及 `HOME`、项目层、用户层联动，再补 `tests/integration/fixture-project-smoke.test.js`

---

## 5. Fixture 烟测原则

`tests/integration/fixture-project-smoke.test.js` 是当前最接近真实使用的一层测试。新增类似测试时遵守下面几条：

- 使用临时 `HOME`，不要污染真实 `~/.hx`、`~/.claude`、`~/.codex`
- 使用临时项目目录，并显式创建 `.git/`
- 通过 `spawnSync(process.execPath, [bin/hx.js, ...])` 真实调用 CLI
- 只依赖本地文件系统，不依赖网络、外部服务和用户真实环境
- 覆写验证要区分三层：
  - 项目层 `.hx/...`
  - 用户层 `~/.hx/...`
  - 系统层 `src/...`

---

## 6. 当前测试网覆盖的高风险点

- 自定义 profile 缺少 `label` 时的兜底
- `hx uninstall` 清理全局安装产物但保留用户自定义内容
- `hx-init` 项目脚手架要求不被删减
- `hx-go` 默认主路径和阶段编号不漂移
- `hx-doc` / `hx-plan` / `hx-run` / `hx-mr` 的关键参数契约不漂移
- `hx-command-index.html` / `hx-onboarding.html` / `hx-deep-dive.html` / `harness-engineering-spec.html` 不再和实现脱节

---

## 7. 后续扩展建议

如果后面继续扩测试，优先级建议如下：

1. 发布面校验
   - `npm pack --dry-run` 产物内容
   - `package.json.files` 白名单是否漏掉关键文件
2. 更细的 fixture 场景
   - 自定义 profile
   - 自定义 `paths.taskDoc`
   - 项目级 `CLAUDE.md` 标记块更新
3. 文档发布面一致性
   - README 与 HTML 指南中的命令数量、命名、路径说明

---

## 8. 维护原则

- 新增功能时，不要只补实现；至少决定它属于“单元契约测试”还是“fixture 集成测试”
- 文档改动如果改变了命令语法、阶段定义或默认主路径，必须同步补测试
- 能用现有测试文件承接的，优先增量补到原文件；只有新增维度明显不同，再新建测试文件
- 避免测试里复制整份文档内容；只校验高信号、容易漂移的关键文本
