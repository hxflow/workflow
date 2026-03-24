# Phase 07 · 熵扫描报告

参数: $ARGUMENTS（可选: `--profile <team[:platform]>`）

不指定 --profile 则扫描全局，指定则增加团队专项检查。

## 执行步骤

### 1. AI Slop 模式扫描

**全局扫描**（`harness-scaffold/src/**` 或对应平台目录）：

| 模式 | 规则 | 严重度 |
|------|------|--------|
| `console.log` | GP-001 | 🔴 |
| `catch (e) { // ` 空 catch | GP-004 | 🔴 |
| `: any` | GP-009 | 🟡 |
| `TODO` / `FIXME` / `HACK` | 质量标记 | 🟡 |
| `as XXX` 类型断言 | GP-010 | 🟡 |
| 超过 200 行的文件 | GP-006 | 🟡 |

**团队专项扫描**（根据 --profile）：

后端：
- Repo 层含业务逻辑（GP-BE-001）
- Service 层缺少单元测试（GP-BE-002）
- 魔法数字（GP-BE-004）

前端：
- 组件直接 fetch（GP-FE-001）
- 内联样式对象（GP-FE-003）
- a11y 缺失（GP-FE-004）

移动端：
- Domain 层引入平台 API（GP-MB-001）
- UI 直接调用 Data（GP-MB-002）
- 可变状态暴露（GP-MB-003）
- 平台特定：force unwrap / !! / FA 废弃 API

### 2. 文档新鲜度检查
- 扫描 `harness-scaffold/docs/requirement/*.md`
- 对每个文档中引用的源文件，比较最后修改时间
- 如果源码比文档更新，标记为可能过期

### 3. 架构合规检查
- 根据 Profile 中 `architecture.layers` 和 `can_import` 定义检查跨层导入
- 后端：src/repo/ 是否导入了 src/service/
- 前端：src/components/ 是否导入了 src/services/
- 移动端：ui/ 是否导入了 data/，domain/ 是否导入了平台 API

### 4. 进度文件审计
- 扫描所有 `docs/plans/*-progress.json`
- 如果指定 --profile，只检查匹配的进度文件
- 列出超过 2 周未更新且仍有 pending 的 TASK
- 列出已完成但未从 AGENTS.md 移除的特性

### 5. 黄金原则覆盖度
- 全局 GP-001~GP-012 的 lint 覆盖情况
- 团队 GP-XX-XXX 的 lint 覆盖情况（如果指定了 --profile）

## 输出格式

```
── 熵扫描报告 ──────────────────────────
📅 扫描时间: 2024-03-15
👥 团队: ${TEAM_LABEL}
📁 扫描范围: ${SCAN_PATH}

■ AI Slop 检测
  🔴 console.log ×2 — src/service/authService.ts, src/hooks/useLogin.ts
  🟡 : any ×1 — src/repo/userRepo.ts:34

■ 团队专项
  🔴 GP-BE-001 违规: src/repo/userRepo.ts 含业务判断

■ 文档新鲜度
  ⚠ docs/requirement/user-login.md 可能过期

■ 架构合规
  ✓ 无跨层违规

■ 进度审计
  ⚠ user-login: TASK-BE-05 已 pending 超过 14 天

■ 规则覆盖
  ⚠ GP-BE-004（禁止魔法数字）尚无对应 lint 规则

── 建议操作 ─────────────────────────
1. 修复 2 个 console.log
2. 重构 src/repo/userRepo.ts 中的业务逻辑
3. 更新 docs/requirement/user-login.md
```
