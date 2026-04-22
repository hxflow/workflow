# Changelog

## v4.0.2 — 2026-04-22

### 新功能
- 支持 workspace 多项目执行
- add workspace

### 修复
- align hx-check test setup with main conflict region
- stabilize hx-check CI execution
- robust hx-check branch detection in test repos

### 重构
- tidy hx-check branch detection helpers

### 其他
- merge: resolve conflicts with origin/main
- cover unborn branch detection in hx-check
- Initial plan

## v3.2.3 — 2026-04-10

### 新功能
- 新增 bugfix 工作流支持并优化契约 context 体积

## v3.2.2 — 2026-04-02

### 其他
- 更新 release 命令加入 changelog 步骤


## 3.1.2 - 2026-04-01

### Changed

- 新增 `src/contracts/runtime-contract.md` 作为所有 `hx-*` 命令共享的运行时规则入口。
- 生成的 skill 入口现在会先加载运行时规则，再执行具体命令正文。
- `hx-go` 与命令契约文案收敛为“命令只负责业务步骤，不重复定义 command / hook / pipeline 规则”。
- README 与 guide 文档同步到新的全局规则模型。

### Validation

- `npm run hx:test`
- `env npm_config_cache=/tmp/hx-npm-cache npm pack --dry-run`
- `13` 个测试文件通过
- `75` 个测试通过

## 3.1.1 - 2026-04-01

### Changed

- 新增 `src/contracts/runtime-contract.md` 作为所有 `hx-*` 命令共享的运行时规则入口。
- 生成的 skill 入口现在会先加载运行时规则，再执行具体命令正文。
- `hx-go` 与命令契约文案收敛为“命令只负责业务步骤，不重复定义 command / hook / pipeline 规则”。
- README 与 guide 文档同步到新的全局规则模型。

### Validation

- `npm run hx:test`
- `npm pack --dry-run --cache /tmp/hx-npm-cache`
- `8` 个测试文件通过
- `33` 个测试通过
## 3.1.0 - 2026-03-31

### Changed

- `hx setup` 不再出现 agent 候选列表，默认直接安装当前模型。
- 安装入口收敛为两类固定目标：
  - `~/.claude/skills/`
  - `~/.agents/skills/`
- 只有 `claude` 保留单独入口，其他 agent 统一并入 `agents`。
- `~/.hx/settings.yaml` 现在只记录 `frameworkRoot`，不再写入 `agents`。
- `hx migrate` 改为旧版本迁移命令，只负责把 `1.x / 2.x` 安装产物迁到当前模型。
- `hx migrate` 默认重建 `claude + agents`，不再兼容旧的独立 agent 目录选择逻辑。
- CLI 在当前工作目录已被删除时，仍可安全执行 `hx migrate` / `hx setup`。
- README、guide、design 文档已同步到新的安装与迁移模型。

### Validation

- `npm run hx:test`
- `npm pack --dry-run --cache /tmp/hx-npm-cache`
- `8` 个测试文件通过
- `33` 个测试通过

## 3.0.0 - 2026-03-31

### Changed

- 主链路不再暴露 `taskId`，`hx-doc` 改为无参数入口。
- `feature` 改为基于需求详情生成的项目内稳定标识，优先中文，后续命令只续接不重算。
- `hx-doc`、`hx-plan`、`hx-run` 明确默认路径：
  - `docs/requirement/{feature}.md`
  - `docs/plans/{feature}.md`
  - `docs/plans/{feature}-progress.json`
- Hook 从覆盖规则改为中间件链：
  - `pre_*`: 框架层 -> 用户层 -> 项目层
  - `post_*`: 项目层 -> 用户层 -> 框架层
- Hook 公共规范收敛为固定输入输出接口：
  - 输入：`command`、`phase`、`projectRoot`、`feature`、`paths`、`gates`、`arguments`、`context`
  - 输出：`patch`、`warnings`、`abort`、`message`、`artifacts`
- 安装模型收敛为“一套 workflow skill，多 agent 安装”。
- 框架内部继续保留 `src/commands/`、`~/.hx/commands/`、`.hx/commands/`。
- agent 入口统一安装到各自的 `skills` 目录。
- forwarder 模板收敛为一套：
  - `src/templates/forwarders/skill-layered.md`
  - `src/templates/forwarders/skill-protected.md`
- `hx setup` 改为首次交互选择 agent，并将选择写入 `~/.hx/settings.yaml`。
- `hx setup` 后续默认复用 `~/.hx/settings.yaml` 中记录的 `agents`。
- 安装流程改为显式动作，移除自动 `postinstall`。
- README、guide、design 文档已统一到当前模型。

### Added

- 新增框架级 Hook：
  - `src/hooks/pre_doc.md`
  - `src/hooks/pre_fix.md`
- 新增仓库级 agent 协作说明：
  - `AGENTS.md`
- 新增重构总结文档：
  - `docs/design/hx-refactor-summary.md`

### Removed

- 移除 `src/scripts/hx-postinstall.js`
- 移除 package.json 中的 `postinstall`
- 移除 `tests/integration/hx-postinstall.test.js`
- 移除 agent `qwen`
- 移除旧模板：
  - `src/templates/forwarders/claude-layered.md`
  - `src/templates/forwarders/claude-protected.md`
  - `src/templates/forwarders/codex-layered.md`
  - `src/templates/forwarders/codex-protected.md`

### Supported Agents

- `claude`
- `codex`
- `cursor`
- `gemini`
- `kimi`
- `windsurf`

### Validation

- `npm run hx:test`
- `8` 个测试文件通过
- `31` 个测试通过

### Related Commits

- `b53a27d` `refactor: 收敛 skill 安装模型与 hook 规范`
- `3646fd9` `docs: 补充仓库 agent 协作说明`
