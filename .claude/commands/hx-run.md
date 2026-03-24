# Phase 04 · Agent 执行任务

参数: $ARGUMENTS（格式: `<feature-name> <task-id> [--profile <team[:platform]>]`）

示例:
- `/hx-run user-login TASK-BE-03 --profile backend`
- `/hx-run user-login TASK-IOS-04 --profile mobile:ios`

## 执行步骤

### 0. 解析参数
- 从 $ARGUMENTS 中解析 feature-name、task-id 和 --profile
- 未提供则提示用法并停止
- 如果未提供 --profile，从 progress.json 的 `profile` 字段读取

### 1. 加载上下文（必须先读再做）
按顺序读取以下文件：
1. `harness-scaffold/AGENTS.md` — 获取执行规则
2. `harness-scaffold/docs/golden-principles.md` — 全局黄金原则
3. `harness-scaffold/profiles/${TEAM}/golden-rules.md` — 团队专属黄金原则
4. `harness-scaffold/profiles/${TEAM}/profile.yaml` — 架构层级和约束
5. 移动端追加：`harness-scaffold/profiles/mobile/platforms/${PLATFORM}.yaml` — 平台特化约束
6. `harness-scaffold/docs/plans/${FEAT}.md` — 执行计划
7. `harness-scaffold/docs/requirement/${FEAT}.md` — 需求文档
8. 读取 progress.json，确认该 TASK 状态不是 `done`

### 2. 构建执行 Prompt
根据 Profile 构建 Prompt：
- **引用 TASK-ID**：明确当前执行的是哪个任务
- **指定输出文件路径**：从计划中获取，路径模板由 Profile 定义
- **引用已有类型/模块**：禁止重复发明
- **引用 AC**：对照需求文档中的验收标准
- **引用黄金原则**：全局 GP-001~GP-012 + 团队专属 GP-XX-XXX
- **架构约束**：从 Profile 的 `architecture.layers` 和 `can_import` 获取
- **平台约束**（移动端）：语言、框架、最低版本、特定限制

### 3. 执行
按照构建的 Prompt 执行代码生成，遵循 Profile 中定义的架构和规范。

### 4. 自验
执行完成后自动检查：
- 生成的文件是否在 Profile 定义的正确架构层级目录
- 全局黄金原则违规（console.log、any、裸 throw）
- 团队黄金原则违规（根据 golden-rules.md 检查）
- 平台特定违规（移动端：force unwrap、!!、废弃 API 等）
- 如果当前 workflow framework 的 profile 中有门控配置，运行对应的门控命令（Profile 中 `gate_commands` 定义）

### 5. 更新进度
- 将 progress.json 中该 TASK 的 status 改为 `done`，写入 completedAt
- 输出完成摘要

## 输出格式

```
── 执行 TASK-BE-03 ─────────────────────
📋 特性: user-login
👥 团队: 服务端
📄 需求文档: docs/requirement/user-login.md
🎯 任务: Service 层 - 认证逻辑

[执行代码生成...]

✓ 文件已创建: src/service/authService.ts
✓ 黄金原则检查通过（全局 + 服务端）
✓ 进度已更新: TASK-BE-03 → done

下一个待执行任务: TASK-BE-04（Controller 层）
运行: /hx-run user-login TASK-BE-04 --profile backend
```

## 禁止事项
- 不在同一会话连续执行多个 TASK
- 不跳过上下文加载直接写代码
- 不自行发明类型/接口，必须引用已有定义
