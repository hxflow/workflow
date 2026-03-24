# Phase 05 · 代码审查

参数: $ARGUMENTS（可选: `[PR编号] [--profile <team[:platform]>]`）

## 执行步骤

### 1. 获取变更范围
- 优先使用 `git diff`（未暂存 + 已暂存的变更）
- 如果无变更，使用 `git diff HEAD~1` 审查最近一次 commit
- 如果提供了 PR 编号，使用 `gh pr diff` 获取

### 2. 加载审查依据
读取以下文件：
1. `.harness/docs/golden-principles.md`（全局黄金原则）
2. `.harness/docs/map.md`（架构层级）
3. 如果指定了 --profile：
   - `.harness/.harness/profiles/${TEAM}/golden-rules.md`（团队专属黄金原则）
   - `.harness/.harness/profiles/${TEAM}/review-checklist.md`（团队审查清单）
   - `.harness/.harness/profiles/${TEAM}/profile.yaml`（架构层级定义）
   - 移动端追加：`.harness/profiles/mobile/platforms/${PLATFORM}.yaml`

如果未指定 --profile，尝试从变更文件路径推断团队（src/service/ → backend, src/components/ → frontend 等）

### 3. 自动扫描

**全局检查**（始终执行）：
- `console.log` 存在于 `src/`（GP-001）
- `: any` 类型泄漏（GP-009）
- 裸 `throw new Error('...')`（GP-003）
- 过度 try-catch（GP-004）

**团队专项检查**（根据 Profile 或 review-checklist.md）：

后端：
- Service 层是否 import 了 Runtime/UI 模块
- Repo 层是否包含业务逻辑
- 错误码是否已注册
- 日志字段是否完整

前端：
- 组件内是否直接 fetch/axios（GP-FE-001）
- 单文件是否超 200 行（GP-FE-002）
- Props 接口是否与需求文档一致
- 是否绕过现有 UI 组件库

移动端：
- Domain 层是否引入平台 API（GP-MB-001）
- UI 层是否直接调用 Data 层（GP-MB-002）
- ViewModel 是否持有 View 强引用（GP-MB-007）
- 平台特定：force unwrap / !! / FA 模型废弃 API

**AI Slop 检查**：
- 过度抽象：只用一次的逻辑被提取为独立函数/Hook
- 冗余注释：对自解释代码添加无意义注释
- 不必要的类型断言 `as XXX`

**文档同步**：
- 新增/修改的接口是否已反映在 `.harness/requirement/` 对应文档中

### 4. 输出报告

按 review-checklist.md 的分级输出：

```
── 代码审查报告 ─────────────────────────
👥 团队: 服务端
📋 审查依据: golden-principles.md + GP-BE-001~005 + review-checklist.md

🔴 必须修复（阻断合并）
  1. src/service/authService.ts:47 — 违反 GP-003: 裸 throw new Error
  2. src/repo/userRepo.ts:23 — 违反 GP-BE-001: Repo 层包含业务判断

🟡 建议修复
  1. src/hooks/useLogin.ts:23 — GP-009: 参数类型为 any

⚪ 观察项
  1. .harness/requirement/user-login.md — AC-003 与代码实现不一致

摘要: 2 🔴 | 1 🟡 | 1 ⚪
修复后运行: /hx-gate --profile backend
```
