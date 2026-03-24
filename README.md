# Harness Engineering Workflow Framework

基于 OpenAI Harness Engineering 实践的团队交付 workflow framework。
克隆即用，包含完整文件夹结构、短命令体系、Git Hooks 和文档模板。

---

## 快速开始

```bash
# 1. 克隆后初始化（安装依赖 + Git Hooks）
chmod +x setup.sh && ./setup.sh

# 2. 开始第一个需求
npm run hx:doc -- user-login --profile backend   # 创建需求文档
npm run hx:plan -- user-login --profile backend  # 创建执行计划
npm run hx:run -- user-login TASK-BE-01 --profile backend
```

## 引导式安装

如果要把这套 workflow framework 安装到任意现有项目，在模板目录执行：

```bash
cd harness-scaffold
npm run hx:install -- /path/to/your-project
```

如果已经发布成 npm 包，可以直接通过 `npx` 调用安装器：

```bash
npx qiyuan-harness-scaffold /path/to/your-project
```

安装器会做这些事：

- 复制 `AGENTS.md`、`docs/`、`profiles/`、`scripts/`、`.claude/commands`、`.claude/skills` 等框架文件到目标项目
- 生成 `.CLAUDE.md -> AGENTS.md` 链接，供 Claude Code 读取统一上下文入口
- 合并目标项目的 `package.json`，补齐 `hx:*` scripts 和缺失的 devDependencies
- 写入 `harness.config.json`，保存默认 `profile`
- 检测 `GITLAB_TOKEN` 和无双 DevOps API Token（推荐环境变量名 `DEVOPS_API_KEY`），缺失时提示用户设置
- 默认使用 Ink TUI 做引导式安装；非交互场景可配合 `--yes`、`--profile`、`--skip-install` 使用

安装完成后，如果 `harness.config.json` 中已设置默认 profile，大多数命令可以省略 `--profile`。
安装器要求 Node >= 18；如果当前默认 `node` 过旧，会优先尝试系统里其他可用的新版 Node。

---

## 打包发布

```bash
# 校验最终包内容
npm run pack:dry-run

# 生成可分发 tgz
npm run release:pack
```

打包完成后，会在项目根目录得到 `qiyuan-harness-scaffold-<version>.tgz`，可用于本地验证或发布到 npm registry。

---

## 目录结构

```
.
├── AGENTS.md                  ← Agent 上下文入口（≤100行）
├── .CLAUDE.md                 ← 指向 AGENTS.md 的链接（Claude Code 入口）
├── setup.sh                   ← 一次性初始化脚本
├── package.json               ← 所有 hx: 命令定义
│
├── .husky/
│   ├── commit-msg             ← 强制 commit 消息格式
│   ├── pre-commit             ← lint-staged + console.log 检测
│   └── pre-push               ← typecheck + test + arch 完整门控
│
├── .claude/
│   ├── commands/              ← Claude 命令入口（hx-run / hx-plan / hx-review ...）
│   └── skills/                ← Claude 可复用技能（如 gitlab / wushuang-devops）
│
├── scripts/                   ← hx: 命令实现
│   ├── hx-install.cjs         ← 安装器 Node 版本兜底入口
│   ├── hx-vitest.cjs          ← Vitest Node 版本兜底入口
│   ├── hx-ctx-check.js        ← hx:ctx  — 上下文校验
│   ├── hx-new-doc.js          ← hx:doc  — 创建需求文档
│   ├── hx-new-plan.js         ← hx:plan — 创建执行计划
│   ├── hx-agent-run.js        ← hx:run  — 生成 Agent Prompt
│   ├── hx-agent-fix.js        ← hx:fix  — 生成修复 Prompt
│   ├── hx-task-done.js        ← hx:done — 标记任务完成
│   ├── hx-arch-test.js        ← hx:arch — 架构合规测试
│   ├── hx-entropy-scan.js     ← hx:entropy — AI Slop 扫描
│   ├── hx-doc-freshness.js    ← hx:clean   — 文档新鲜度检查
│   └── hx-review-checklist.js ← hx:review  — 打印 Review 清单
│
├── docs/
│   ├── map.md                 ← 系统架构地图（必须维护）
│   ├── golden-principles.md   ← 黄金原则库（GP-001 ~ ）
│   ├── quality-grades.md      ← 模块质量评级（双周更新）
│   ├── requirement/           ← 特性需求文档（每特性一个文件）
│   └── plans/                 ← 执行计划（TASK-XX 结构）
│
├── profiles/                  ← 团队/平台 Profile 配置
│   ├── backend/
│   ├── frontend/
│   └── mobile/
│
└── src/
    ├── types/                 ← Types 层 — 接口和类型定义
    ├── config/                ← Config 层 — 环境变量和常量
    ├── repo/                  ← Repo 层 — 数据访问
    ├── service/               ← Service 层 — 业务逻辑
    ├── runtime/               ← Runtime 层 — HTTP 路由和控制器
    ├── components/
    │   └── ui/                ← 基础 UI 组件库
    ├── hooks/                 ← 自定义 Hook
    └── pages/                 ← 页面组件
```

---

## 命令速查

### 文档工具

| 命令 | 说明 |
|------|------|
| `npm run hx:doc -- <name> --profile <team[:platform]>` | 从团队模板创建需求文档 `docs/requirement/<name>.md` |
| `npm run hx:plan -- <name> --profile <team[:platform]>` | 按 profile 拆分任务并生成计划 + JSON 进度文件 |
| `npm run hx:ctx -- --profile <team[:platform]>` | 校验 requirement、progress 和 profile 资源完整性 |

### Agent 工作流

| 命令 | 说明 |
|------|------|
| `npm run hx:run -- user-login TASK-BE-01 --profile backend` | 生成后端任务的 Agent Prompt |
| `npm run hx:run -- order-detail TASK-IOS-01 --profile mobile:ios` | 生成移动端任务的 Agent Prompt |
| `npm run hx:fix` | 读取最近测试失败，生成 Bug 修复 Prompt |
| `npm run hx:fix --log="错误文本"` | 指定错误内容生成修复 Prompt |
| `npm run hx:done -- TASK-BE-01` | 标记任务完成，更新进度 JSON，提示下一个任务 |

### 代码质量

| 命令 | 说明 |
|------|------|
| `npm run hx:lint` | ESLint，零容忍（warning 也视为错误） |
| `npm run hx:lint:fix` | ESLint 自动修复 |
| `npm run hx:type` | TypeScript 类型检查 |
| `npm run hx:test` | 全量测试，详细输出 |
| `npm run hx:test:unit` | 仅运行单元测试（scripts/lib 纯逻辑） |
| `npm run hx:test:integration` | 运行 CLI 集成测试（临时项目安装 + 主流程验证） |
| `npm run hx:test:w` | 测试 watch 模式 |
| `npm run hx:test:cov` | 测试 + 覆盖率报告 |
| `npm run hx:gate` | **本地门控**：lint + type + test（提交/推送前运行） |
| `npm run hx:check` | 完整检查：ctx + gate（执行前运行） |

### Review 与合规

| 命令 | 说明 |
|------|------|
| `npm run hx:review -- --profile backend` | 按团队 Review 清单输出审查要点 |
| `npm run hx:review -- --profile frontend` | 打印前端 Review 清单 |
| `npm run hx:review -- --profile mobile:ios` | 打印移动端 iOS Review 清单 |
| `npm run hx:arch -- --profile <team[:platform]>` | 按 profile 的架构层级执行合规测试 |

### 熵管理（双周运行）

| 命令 | 说明 |
|------|------|
| `npm run hx:entropy` | 扫描 AI Slop 模式，输出需处理的问题列表 |
| `npm run hx:clean` | 检查文档与代码的新鲜度，列出可能过期的文档 |

### CI

| 命令 | 说明 |
|------|------|
| `npm run ci` | 完整 CI 流水线：lint + type + test + arch + ctx |

---

## 典型工作流

### 开始一个新需求

```bash
# Step 1：创建需求文档（填写 AC、影响层级、边界约束）
npm run hx:doc -- user-login --profile backend

# Step 2：创建执行计划（拆分 TASK-XX 子任务）
npm run hx:plan -- user-login --profile backend

# Step 3：校验上下文完整性
npm run hx:check -- --profile backend

# Step 4：生成 Agent Prompt，复制给 Claude 执行
npm run hx:run -- user-login TASK-BE-01 --profile backend

# Step 5：Agent 开 PR 后，运行 Review 清单
npm run hx:review -- --profile backend

# Step 6：PR 合并后标记完成
npm run hx:done -- TASK-BE-01
# → 自动提示下一个任务
```

### 修复 Bug

```bash
# 方式 1：让脚本读取最近测试失败
npm run hx:fix

# 方式 2：直接传入错误日志
npm run hx:fix --log="TypeError: Cannot read property 'email' of undefined"

# 方式 3：从日志文件读取
npm run hx:fix --file=logs/error.txt
```

### 双周清理

```bash
npm run hx:entropy   # 发现重复模式 → 更新 Lint 规则
npm run hx:clean     # 发现文档漂移 → 让 Agent 同步文档
```

---

## Git Hooks 说明

| Hook | 触发时机 | 检查内容 |
|------|----------|----------|
| `commit-msg` | `git commit` | commit 消息格式：`<type>: #<taskId>@<taskName>` |
| `pre-commit` | `git commit` | lint-staged，AGENTS.md 行数，console.log |
| `pre-push` | `git push` | typecheck，unit tests，arch 合规 |

**禁止直接 push 到 main/master/production**，必须通过 PR 流程。

---

## 架构规则

架构层级由 Profile 决定：

- 后端：`Types → Config → Repo → Service → Runtime`
- 前端：`Types → Services → Stores → Hooks → Components → Pages`
- 移动端：`Domain → Data → Presentation → UI`

违规由 `hx:arch -- --profile <team[:platform]>` 检测，详见 `docs/map.md` 与 `profiles/`。

---

## 新成员 Onboarding

```bash
# 1. 克隆并初始化
git clone <repo-url> && cd <project>
chmod +x setup.sh && ./setup.sh

# 2. 必读文档
cat AGENTS.md
cat docs/golden-principles.md
cat docs/map.md

# 3. 验证本地环境
npm run hx:check
```

---

## 常见问题

**Q: `hx:gate` 失败了怎么办？**
按顺序检查：① `hx:lint:fix` 自动修复格式问题 → ② `hx:type` 查看类型错误 → ③ `hx:test:w` 调试测试

**Q: Agent 执行失败怎么办？**
先修复环境，再重开会话。检查：文档是否完整 → 类型定义是否准确 → AGENTS.md 链接是否有效 (`hx:ctx`)

**Q: 想跳过 Hook 怎么办？**
`git commit --no-verify`（仅限紧急情况，需在 PR 中说明原因）

**Q: AGENTS.md 超过 100 行怎么办？**
把详细规则移到 `docs/` 下对应文档，AGENTS.md 只留指针（`→ docs/xxx.md`）
