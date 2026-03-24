# Phase 03 · 上下文完整性校验

参数: $ARGUMENTS（可选: `--profile <team[:platform]>`，不提供则校验全部）

## 检查项（全部通过才算合格）

### 1. AGENTS.md 健康检查
- 读取 `.harness/AGENTS.md`
- 行数 ≤ 100 行，超出则报错并建议精简
- 所有 `→` 引用的文档路径必须实际存在，逐个检查

### 2. 活跃特性完整性
- 读取 AGENTS.md 中「当前活跃特性」列出的所有计划文件
- 每个计划文件对应的需求文档 `.harness/requirement/xxx.md` 必须存在
- 需求文档中的 AC 不为空

### 3. 进度文件一致性
- 扫描 `.harness/plans/*-progress.json`
- 如果指定了 --profile，只检查匹配 profile 的进度文件
- 检查每个 JSON 中 `requirementDoc` 指向的文件是否存在
- 检查是否有状态为 `in-progress` 但计划文件中描述缺失的 TASK

### 4. 黄金原则可达
- `.harness/docs/golden-principles.md` 必须存在且非空（全局）
- `.harness/docs/map.md` 必须存在且非空
- 如果指定了 --profile，额外检查 `.harness/.harness/profiles/${TEAM}/golden-rules.md` 存在

### 5. Profile 完整性（指定 --profile 时）
- `.harness/.harness/profiles/${TEAM}/profile.yaml` 存在且可解析
- `.harness/.harness/profiles/${TEAM}/requirement-template.md` 存在
- `.harness/.harness/profiles/${TEAM}/plan-template.md` 存在
- `.harness/.harness/profiles/${TEAM}/review-checklist.md` 存在
- `.harness/.harness/profiles/${TEAM}/golden-rules.md` 存在
- 移动端额外检查：`.harness/profiles/mobile/platforms/${PLATFORM}.yaml` 存在

## 输出格式

```
── 上下文校验 ──────────────────────────
✓ AGENTS.md: XX 行（≤100）
✓ 文档引用: X/X 个有效
✓ 活跃特性: [feature-a]（backend, 3/5 完成）
✓ 黄金原则: 全局 GP-001~GP-012 + 团队 GP-BE-001~GP-BE-005
✓ 架构地图: 存在
✓ Profile: backend 完整（5/5 文件）

全部通过，可以开始 Agent 执行。
```
