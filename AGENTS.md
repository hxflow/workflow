# AGENTS.md — 代理上下文目录
# 保持在 100 行以内。这是 Agent 每次会话启动时读取的索引文件。
# 详细规则在下方链接的文档中，不要内联到这里。

## 架构与依赖规则

本仓库采用 profile-driven 架构，实际依赖方向以当前任务对应的 `profiles/*/profile.yaml` 为准：

- 后端：Types → Config → Repo → Service → Runtime
- 前端：Types → Services → Stores → Hooks → Components → Pages
- 移动端：Domain → Data → Presentation → UI
- 每一层只能导入 `architecture.layers.can_import` 允许的层
- 禁止写死单一团队层级，移动端还要叠加 `profiles/mobile/platforms/*.yaml`
- Auth / Telemetry / Feature Flags 通过 Providers 或协议注入

→ 详细层级定义：docs/map.md

## 黄金原则（必读）

→ docs/golden-principles.md

执行任何任务前必须读取黄金原则，违反原则的代码不允许合并。

## 当前活跃特性

（无）— 开始新特性时在此处添加：
→ docs/plans/[feature-name].md（状态：进行中）

## 核心文档索引

→ docs/map.md               系统架构全图
→ docs/golden-principles.md 团队黄金原则（Lint 规则来源）
→ docs/quality-grades.md    模块质量评级（双周更新）
→ docs/requirement/         特性需求文档（每特性一个文件）
→ docs/plans/               执行计划（TASK-XX 结构）
→ profiles/                 团队 / 平台 Profile 配置

## 执行规则

1. 所有命令优先显式传 `--profile <team[:platform]>`
2. 所有代码必须通过当前 profile 对应的 `npm run hx:gate -- --profile <team[:platform]>`
3. Service / Hook / ViewModel 等核心逻辑必须有对应测试，无测试的 PR 不允许合并
4. 所有错误使用 AppError 类，不允许 throw new Error('raw string')
5. 禁止 console.log 进入 src/，使用结构化 logger
6. 完成任务后更新 docs/plans/ 中对应 TASK 的状态为 done
