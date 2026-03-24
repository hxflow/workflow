# Phase 02 · 生成执行计划

参数: $ARGUMENTS（格式: `<feature-name> [--profile <team[:platform]>]`）

示例:
- `/hx-plan user-login --profile backend`
- `/hx-plan user-login --profile mobile:ios`

## 执行步骤

### 0. 解析参数
- 提取 feature-name 和 --profile
- 未提供 feature-name 则提示用法并停止
- 未提供 --profile，尝试从 `.harness/requirement/$FEAT.md` 文档头部读取团队标签，读不到则询问

### 1. 加载 Profile 配置
- 读取 `.harness/.harness/profiles/${TEAM}/profile.yaml`
- 获取 `task_split.strategy`、`task_split.order`、`task_split.template`
- 获取 `task_prefix`（TASK-BE / TASK-FE / TASK-MB）
- 移动端追加读取平台 yaml，获取 `task_prefix_override`（TASK-IOS / TASK-AND / TASK-HM）
- 读取 `.harness/.harness/profiles/${TEAM}/plan-template.md` 作为计划模板

### 2. 读取需求文档
- 读取 `.harness/requirement/$FEAT.md`，不存在则提示先运行 `/hx-doc`
- 提取 AC 列表和影响的架构层级

### 3. 自动拆分任务
根据 Profile 中的 `task_split` 配置拆分：
- **后端**（layer_by_layer）：Types → Repo → Service → Runtime → Test
- **前端**（component_first）：Types → Component → Hook → Page → Test
- **移动端**（clean_arch）：Domain → Data → Presentation → UI → Test

每个 TASK 必须：
- 使用 Profile 中的 `task_prefix`
- 有明确的输出文件路径（来自 `task_split.template`）
- 引用需求文档中的 AC
- 可独立测试

### 4. 生成文件
- `.harness/plans/$FEAT.md`（基于团队计划模板）
- `.harness/plans/$FEAT-progress.json`（含 profile 信息）

progress.json 结构：
```json
{
  "feature": "feature-name",
  "profile": "backend",
  "platform": null,
  "requirementDoc": ".harness/requirement/feature-name.md",
  "tasks": [
    { "id": "TASK-BE-01", "name": "Types 层", "status": "pending", "output": "src/types/..." }
  ]
}
```

### 5. 更新 AGENTS.md
将新计划路径追加到「当前活跃特性」区块，标注团队

### 6. 输出摘要
```
✓ 执行计划已创建:
  .harness/plans/$FEAT.md（X 个 ${TEAM} 任务）
  .harness/plans/$FEAT-progress.json
  AGENTS.md 已更新

下一步:
  /hx-ctx --profile ${PROFILE}     # 校验上下文完整性
  /hx-run $FEAT ${TASK_ID} --profile ${PROFILE}  # 执行第一个任务
```

## 拆分原则

- 每个 TASK 对应一个可测试产物
- 总 TASK 数控制在 3~6 个
- 依赖关系严格按 Profile 中的架构层级排列
- 每个 TASK 的 Prompt 模板预填在计划文件中
