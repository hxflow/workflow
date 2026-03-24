# Phase 01 · 创建需求文档

参数: $ARGUMENTS（格式: `<feature-name> [--task <task-id>] [--profile <team[:platform]>]`）

示例:
- `/hx-doc user-login --task 12345 --profile backend`
- `/hx-doc user-login --profile frontend`
- `/hx-doc user-login --task 12345 --profile mobile:ios`

## 执行步骤

### 0. 解析参数
- 从 $ARGUMENTS 中提取 feature-name（kebab-case）、--task（DevOps 任务 ID，可选）和 --profile 值
- 如果未提供 feature-name，提示用法并停止
- 如果未提供 --profile，询问用户选择团队：`backend / frontend / mobile:ios / mobile:android / mobile:harmony`
- 将 profile 存为变量 `TEAM`（如 `backend`）和 `PLATFORM`（如 `ios`，仅移动端）

### 1. 从 DevOps 平台拉取任务详情
- 如果提供了 `--task <task-id>`：
  1. 通过 `wushuang-devops` skill 调用 DevOps MCP 查询任务详情（标题、描述、优先级、迭代、关联需求、子任务）
  2. 提取任务中的关键信息作为需求文档的输入预填内容
  3. 如果任务有子任务列表，一并拉取作为 AC 候选项
  4. 展示拉取到的摘要，询问用户确认
- 如果未提供 `--task`：
  - 询问用户是否需要从 DevOps 平台拉取任务（提供任务 ID 即可）
  - 用户选择跳过则进入手动填写流程

### 2. 加载 Profile 配置
- 读取 `.harness/.harness/profiles/${TEAM}/profile.yaml` 获取架构层级和团队配置
- 如果是移动端且有平台参数，追加读取 `.harness/.harness/profiles/mobile/platforms/${PLATFORM}.yaml`
- 读取 `.harness/.harness/profiles/${TEAM}/requirement-template.md` 作为需求文档模板
- 如果团队模板不存在，回退到全局模板 `.harness/requirement/_template.md`

### 3. 创建文档
- 检查 `.harness/requirement/$FEAT.md` 是否已存在，存在则提示并停止
- 基于**团队专属模板**创建需求文档，自动填入：
  - feature-name 替换占位符
  - 今天的日期
  - 状态设为「草稿」
  - 团队标签（服务端/前端/移动端）
  - 移动端时：填入目标平台（iOS/Android/HarmonyOS）
  - **来源信息**：如果有 DevOps 任务，填入任务 ID、标题、优先级、迭代
  - **预填内容**：从 DevOps 任务描述中提取的背景、AC 候选项

### 4. 交互式填写
引导用户逐步填写/确认以下必填字段（如果从 DevOps 拉取了内容，展示预填值供用户修改）：
- **来源**：DevOps 任务 ID 和标题（已从平台拉取则自动填入）
- **背景**：需求来源和动机（1-3 句话）
- **验收标准（AC）**：每条必须可自动化测试验证，包含具体的行为描述。提醒用户：模糊的 AC 无法驱动 Agent 执行
- **影响的架构层级**：根据团队 Profile 中的 `architecture.layers` 列出可选层级（而非硬编码）
- **边界约束**：明确本期不做什么

团队特定字段：
- **后端**：接口定义（请求/响应类型）、错误码表
- **前端**：Figma 链接、Props 接口、状态管理方案、响应式要求
- **移动端**：设计稿、目标平台勾选、API 契约、离线策略、权限申请

### 5. 完成输出
```
✓ 需求文档已创建: .harness/requirement/$FEAT.md
  来源: DevOps #${TASK_ID} — ${TASK_TITLE}
  团队: ${TEAM_LABEL}
  架构层级: ${LAYER_LIST}
下一步: /hx-plan $FEAT --profile ${PROFILE}
```

## 质量检查

- AC 中不允许出现「要快」「友好提示」「安全性要好」这类模糊描述
- 如果检测到模糊 AC，主动建议用户改为可量化的版本
- 验证影响的架构层级与 Profile 中定义的层级匹配
- 如果提供了 DevOps 任务 ID，验证文档中的来源字段已正确填写
