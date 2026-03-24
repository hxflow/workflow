# Phase 05 · 修复 Review 意见

参数: $ARGUMENTS（格式: `[PR编号或文本] [--profile <team[:platform]>]`）

## 执行步骤

### 1. 获取 Review 意见
- 如果 $ARGUMENTS 包含 PR 编号（纯数字），使用 `gh api repos/.../pulls/N/comments` 获取评论
- 如果 $ARGUMENTS 包含文本内容，直接解析为修复指令
- 如果无参数，询问用户粘贴 Review 意见

### 2. 加载上下文
读取：
1. `harness-scaffold/docs/golden-principles.md`（全局）
2. `harness-scaffold/docs/map.md`
3. 如果指定了 --profile：
   - `harness-scaffold/profiles/${TEAM}/golden-rules.md`
   - `harness-scaffold/profiles/${TEAM}/profile.yaml`
   - 移动端追加平台 yaml
4. 涉及文件的对应需求文档

### 3. 逐条修复
- 解析每条 Review 意见，定位到具体文件和行号
- 按照全局 + 团队黄金原则和架构规则修复
- 不改变未被提及的代码
- 修复后不引入新的违规

### 4. 自验
- 运行 `/hx-gate --profile ${PROFILE}` 的检查逻辑确认修复没有引入新问题
- 输出修复摘要

## 输出格式

```
── 修复 Review 意见 ──────────────────────
👥 团队: ${TEAM_LABEL}

修复 1/3: src/service/authService.ts:47
  问题: 裸 throw new Error → 改为 AppError（GP-003）
  ✓ 已修复

修复 2/3: src/repo/userRepo.ts:23
  问题: Repo 层包含业务逻辑（GP-BE-001）→ 移至 Service 层
  ✓ 已修复

修复 3/3: docs/requirement/user-login.md
  问题: AC-003 与代码不一致 → 更新文档
  ✓ 已修复

自验: lint ✓ | typecheck ✓ | test ✓
```
