# 批量执行所有待完成任务

参数: $ARGUMENTS（格式: `<feature-name> [--profile <team[:platform]>]`）

跳过 Phase 01-02（假设需求文档和执行计划已就绪），直接从 Phase 03 开始执行所有 pending 的 TASK。

---

## 步骤

### 1. 加载计划
- 读取 `harness-scaffold/docs/plans/${FEAT}-progress.json`
- 不存在则报错：「未找到执行计划，请先运行 /hx-plan $FEAT --profile ${PROFILE}」
- 从 progress.json 读取 `profile` 和 `platform` 字段
- 如果提供了 --profile 参数，以参数为准
- 加载 `profiles/${TEAM}/profile.yaml`（移动端追加平台 yaml）
- 列出所有 TASK 及其状态，过滤出 `pending` 的任务

### 2. 上下文校验
- 执行 /hx-ctx --profile ${PROFILE} 的所有检查项
- 失败则停止

### 3. 确定执行顺序
读取 Profile 中的 `task_split.order`，构建依赖图：

后端串行链: TASK-BE-01 → BE-02 → BE-03 → BE-04 → BE-05
前端串行链: TASK-FE-01 → FE-02 → FE-03 → FE-04 → FE-05
移动端串行链: TASK-MB-01 → MB-02 → MB-03 → MB-04 → MB-05

### 4. 逐 TASK 执行
对每个 pending TASK，使用 Agent 子进程执行：

- 传入完整上下文（AGENTS.md + 全局黄金原则 + 团队黄金原则 + 需求文档 + 计划）
- 传入 Profile 架构约束（层级、can_import、平台限制）
- 指定输出路径、关联 AC
- 完成后自检违规（全局 + 团队规则）
- 更新 progress.json

### 5. 全量审查 + 门控
所有 TASK 完成后：
- 执行 /hx-review --profile ${PROFILE} 逻辑（扫描所有变更）
- 🔴 项自动修复（最多 2 轮）
- 执行 /hx-gate --profile ${PROFILE} 逻辑
- 失败自动修复（最多 3 轮）

### 6. 提交与 MR（可选）
完成后询问用户是否继续：
- git commit（格式：`<type>: #<taskId>@<taskName>`）
- git push
- 创建 MR（执行 /hx-mr 逻辑）
- 后台监控 CI

### 7. 输出报告

```
── 批量执行完成 ──────────────────────
特性: $FEAT
团队: ${TEAM_LABEL}
执行: X 个 TASK
耗时: ~N 个 Agent 子进程

进度:
  ✓ TASK-BE-01  Types 层
  ✓ TASK-BE-02  Repo 层
  ✓ TASK-BE-03  Service 层
  ✓ TASK-BE-04  Controller 层
  ✓ TASK-BE-05  单元测试

门控: lint ✓ | type ✓ | test ✓ | arch ✓
审查: 0 🔴 | 2 🟡 | 1 ⚪
MR:   ${MR_URL} (CI 监控中...)
```
