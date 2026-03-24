# 全自动流水线 · 从需求到交付

参数: $ARGUMENTS（格式: `<feature-name> [--task <task-id>] --profile <team[:platform]>`）

示例:
- `/hx-go user-login --task 12345 --profile backend`
- `/hx-go user-login --profile frontend`
- `/hx-go user-login --task 12345 --profile mobile:ios`
- `/hx-go user-login --profile mobile:android`
- `/hx-go user-login --profile mobile:harmony`

你是 Harness Engineering 自动化流水线的编排器。收到 feature-name 和 profile 后，按顺序驱动 Phase 01 → 08 的完整流程。每个 TASK 使用 Agent 子进程执行以隔离上下文。在需要人工确认的节点暂停等待用户输入。

---

## 阶段 0 · 参数校验与 Profile 加载

- 如果 $ARGUMENTS 为空，提示用法并停止
- 从 $ARGUMENTS 解析 feature-name（`FEAT`）、任务 ID（`TASK_ID`，可选）、团队（`TEAM`）、平台（`PLATFORM`，仅移动端）
- 如果未提供 --profile，询问用户选择：`backend / frontend / mobile:ios / mobile:android / mobile:harmony`
- 项目工作目录：`.harness/`，框架 Profile 由 `hx` CLI 从安装包自动加载

**加载配置文件：**
1. `.harness/.harness/profiles/${TEAM}/profile.yaml` — 团队配置（架构层级、任务拆分规则、审查重点、QA 要求）
2. `.harness/.harness/profiles/${TEAM}/requirement-template.md` — 需求文档模板
3. `.harness/.harness/profiles/${TEAM}/plan-template.md` — 执行计划模板
4. `.harness/.harness/profiles/${TEAM}/golden-rules.md` — 团队专属黄金原则
5. `.harness/.harness/profiles/${TEAM}/review-checklist.md` — 审查清单
6. 移动端追加：`.harness/profiles/mobile/platforms/${PLATFORM}.yaml` — 平台特化配置

**提取关键变量：**
- `TASK_PREFIX` ← profile.yaml 的 task_prefix（或平台 yaml 的 task_prefix_override）
- `LAYERS` ← profile.yaml 的 architecture.layers
- `SPLIT_ORDER` ← profile.yaml 的 task_split.order
- `GATE_COMMANDS` ← 平台 yaml 的 gate_commands（移动端）或默认 npm scripts
- `TEAM_LABEL` ← profile.yaml 的 label

---

## 阶段 1 · Phase 01 需求文档（需人工确认）

1. **从 DevOps 平台拉取任务**（如提供了 `--task`）：
   - 通过 `wushuang-devops` skill 调用 DevOps MCP 查询任务详情（标题、描述、优先级、迭代、关联需求、子任务）
   - 提取关键信息作为需求文档的预填内容
   - 如果未提供 `--task`，询问用户是否需要关联 DevOps 任务
2. 检查 `.harness/requirement/${FEAT}.md` 是否已存在
   - **已存在**：读取并展示摘要，询问用户是否直接使用
   - **不存在**：基于**团队 requirement-template.md** 创建，填入日期、feature-name、团队标签、DevOps 任务来源
3. 交互式引导用户填写/确认（根据团队模板的字段结构，DevOps 拉取的内容作为预填值）：
   - 通用：来源（DevOps 任务 ID）、背景、AC、边界约束
   - 后端：接口定义、错误码表
   - 前端：Figma 链接、Props 接口、状态管理、响应式要求
   - 移动端：设计稿、目标平台、API 契约、离线策略、权限
   - 影响的架构层级：从 Profile 的 `LAYERS` 中列出可选项
4. 写入文件后展示完整文档，请用户确认

**⏸ 检查点 1：用户确认需求文档后才继续**

---

## 阶段 2 · Phase 02 执行计划（自动）

1. 读取已确认的 `.harness/requirement/${FEAT}.md`
2. 根据 Profile 的 `task_split` 配置自动拆分任务：
   - 使用 `TASK_PREFIX` 作为任务 ID 前缀
   - 按 `SPLIT_ORDER` 排列依赖顺序
   - 每个 TASK 的输出路径从 `task_split.template` 获取
3. 生成 `.harness/plans/${FEAT}.md`（基于团队 plan-template.md）和 `.harness/plans/${FEAT}-progress.json`
4. progress.json 写入 `"profile": "${TEAM}"` 和 `"platform": "${PLATFORM}"`
5. 更新 `.harness/AGENTS.md`「当前活跃特性」，标注团队
6. 展示任务列表摘要，询问用户确认

**⏸ 检查点 2：用户确认执行计划后才继续**

---

## 阶段 3 · Phase 03 上下文校验（自动）

1. 校验 `.harness/AGENTS.md` ≤ 100 行
2. 校验所有 `→` 引用的文档路径存在
3. 校验需求文档 AC 非空
4. 校验全局黄金原则和架构地图文件存在
5. 校验团队 Profile 文件完整（profile.yaml、golden-rules.md、review-checklist.md、requirement-template.md、plan-template.md）
6. 移动端额外校验平台 yaml 存在
7. **全部通过 → 自动继续；任一失败 → 自动修复后重试，最多 2 次**

---

## 阶段 4 · Phase 04 逐任务执行（自动，Agent 隔离）

读取 `.harness/plans/${FEAT}-progress.json`，按 `SPLIT_ORDER` 依赖顺序遍历所有 `pending` 的 TASK。

**对每个 TASK 执行以下循环：**

### 4.1 启动 Agent 子进程
传入以下 Prompt：

```
你正在执行 Harness Engineering 项目中的 ${TASK_ID}。
团队: ${TEAM_LABEL}，平台: ${PLATFORM_LABEL}

先读取以下文件（必须全部读完再动手写代码）：
1. .harness/AGENTS.md
2. .harness/docs/golden-principles.md
3. .harness/.harness/profiles/${TEAM}/golden-rules.md
4. .harness/.harness/profiles/${TEAM}/profile.yaml
${PLATFORM_YAML_LINE}
5. .harness/requirement/${FEAT}.md
6. .harness/plans/${FEAT}.md

然后按照执行计划中 ${TASK_ID} 的描述，生成代码：
- 输出到：${OUTPUT_PATH}
- 满足的 AC：${AC_LIST}
- 使用已有类型/模块：${DEPS}
- 遵循全局黄金原则 GP-001 ~ GP-012
- 遵循团队黄金原则 ${TEAM_GP_RANGE}
- 架构约束：本层只能导入 ${CAN_IMPORT}
${PLATFORM_CONSTRAINTS}

完成后检查自己的产出是否有违规，如有则自行修复。
```

### 4.2 验证产出
Agent 完成后：
- 读取生成的文件，扫描全局 + 团队黄金原则违规
- 平台特定违规检查（iOS: force unwrap, Android: !!, HarmonyOS: FA API）
- 如果发现问题，再启动 Agent 子进程修复，最多重试 2 次

### 4.3 更新进度
- 将该 TASK 在 progress.json 中标记为 `done`
- 输出单行进度：`✓ ${TASK_ID} done (N/M)`

### 4.4 继续下一个 TASK

---

## 阶段 5 · Phase 05 代码审查（自动）

所有 TASK 完成后：

1. 加载团队 `review-checklist.md` 作为审查基线
2. 对所有新增/修改文件执行：
   - 全局黄金原则逐条检查
   - 团队黄金原则逐条检查
   - 团队 review_focus.must 逐条检查
   - AI Slop 检测
   - 文档同步检查
3. 输出分级报告（🔴/🟡/⚪）
4. **🔴 项**：自动 Agent 修复，最多 2 轮
5. **只剩 🟡 和 ⚪**：展示报告请用户确认

**⏸ 检查点 3：用户确认审查结果**

---

## 阶段 6 · Phase 06 质量门控（自动）

读取 Profile 中的 `gate_commands` 配置，按顺序执行对应工具链的门控命令：
- 后端（Go）：golangci-lint → go build → go test → go vet
- 前端（TS/React）：eslint → tsc → vitest → arch check
- iOS（Swift）：swiftlint → xcodebuild build → xcodebuild test
- Android（Kotlin）：gradlew lint → assemble → test
- HarmonyOS（ArkTS）：hvigorw lint → assembleHap → test

- 全部通过 → 继续
- 任一失败 → Agent 自动修复 → 重跑门控 → 最多 3 轮
- 3 轮仍失败 → 暂停请用户介入

---

## 阶段 7 · 收尾与提交

1. 确认所有 TASK 在 progress.json 中均为 `done`
2. 生成变更摘要（影响的文件、AC 完成情况）
3. git commit（格式：`<type>: #<taskId>@<taskName>`，如 `feat: #TS-46474@新增巴士订单订单明细展示&契约对接`）
   - 如果阶段 0 提供了 `--task`，自动从 DevOps 任务中提取 taskId 和 taskName
   - 如果未提供，询问用户输入 DevOps 任务 ID 和名称
4. git push 到远程分支

---

## 阶段 8 · Phase 08 提交 MR（需人工确认）

### 8.1 创建 Merge Request
使用 `gitlab` skill 创建 MR：

```bash
.claude/skills/gitlab/scripts/gitlab mr create \
  -s ${BRANCH} \
  -t main \
  --title "<type>: #<taskId>@<taskName>" \
  -d @mr-description.md \
  -p ${PROJECT_PATH}
```

MR 描述自动生成，包含：
- 关联的 DevOps 任务 ID 和链接
- 变更摘要（新增/修改文件列表）
- AC 完成清单（逐条打勾）
- 门控通过状态
- 影响的架构层级

### 8.2 后台监控 CI
MR 创建后，启动后台 CI 监控：

```bash
.claude/skills/gitlab/scripts/gitlab mr watch -p ${PROJECT_PATH} -i ${MR_IID} -B
```

### 8.3 CI 结果处理
- **CI 通过**：通知用户，展示 MR 链接，建议合并
- **CI 失败**：
  1. 拉取 pipeline 失败详情
  2. Agent 自动分析并修复
  3. git commit + push
  4. 继续监控（最多 3 轮）
  5. 3 轮仍失败 → 暂停请用户介入

### 8.4 输出最终报告

```
══════════════════════════════════════════
  ✓ Harness Pipeline 完成
══════════════════════════════════════════
  特性: ${FEAT}
  团队: ${TEAM_LABEL}
  平台: ${PLATFORM_LABEL}
  任务: X/X 完成
  文件: Y 个新增，Z 个修改
  门控: lint ✓ | build ✓ | test ✓ | arch ✓
  AC:   AC-001 ✓ | AC-002 ✓ | AC-003 ✓
  MR:   ${MR_URL}
  CI:   ✓ passed
══════════════════════════════════════════
```

**⏸ 检查点 4：用户确认 MR 无误后流水线结束**

---

## 错误处理策略

| 场景 | 处理 |
|------|------|
| Agent 子进程执行失败 | 检查文档是否完整 → 补充后重试（最多 2 次） |
| 门控失败 | Agent 自动修复 → 重跑门控（最多 3 轮） |
| MR 创建失败 | 检查分支是否已 push、项目路径是否正确 → 修复后重试 |
| CI 失败 | Agent 分析失败原因 → 自动修复 → push → 重新监控（最多 3 轮） |
| 重试耗尽 | 暂停流水线，展示错误详情，等待用户指令 |
| 用户在检查点说 n | 回到对应阶段重新编辑 |

## 并行策略

- 同一团队内的 TASK：严格按 Profile 的 `SPLIT_ORDER` 串行
- 多团队场景（同一 feature 跨前后端）：后端链 ∥ 前端链（无交叉依赖时）
- 移动端多平台：各平台 TASK 链可并行（共享 Domain 层除外）
