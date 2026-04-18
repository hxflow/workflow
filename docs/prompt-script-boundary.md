# 提示词和脚本边界说明

## 架构层次

```
┌─────────────────────────────────────────────────────┐
│ SKILL.md - 命令路由器                                │
│ 接收 /hx <command> → 执行 hook.ts resolve          │
│ → 路由到 commands/hx-*.md                           │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 命令提示词层 (commands/hx-*.md)                     │
│ • 定义执行步骤（调用哪些脚本）                       │
│ • 说明语义约束（AI 如何解释事实）                    │
│ • 指明下一步命令                                     │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 事实脚本层 (scripts/tools/*.ts)                     │
│ • 返回结构化 JSON 数据                               │
│ • 不包含语义判断逻辑                                 │
│ • 调用共享库获取事实                                 │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 共享库层 (scripts/lib/*.ts)                         │
│ • 格式验证（feature-header.ts）                     │
│ • 任务调度（task-scheduler.ts）                     │
│ • 流水线状态（pipeline-runner.ts）                  │
│ • 运行时配置（runtime-config.ts）                   │
└─────────────────────────────────────────────────────┘
```

## 职责划分

### 提示词（commands/*.md）职责

**应该包含：**
- 执行步骤的高层描述（调用哪些脚本、什么顺序）
- AI 语义判断的边界和原则
- 对脚本返回数据的解释指引
- 明确指向脚本的引用（如 `scripts/lib/feature-header.ts`）

**不应包含：**
- 具体的验证规则（字段名、顺序、格式）
- 数据结构定义（task 状态、pipeline step）
- 算法实现细节（任务调度、依赖计算）
- 配置项枚举（gate 名称、scope 列表）

### 脚本（scripts/tools/*.ts 和 scripts/lib/*.ts）职责

**应该包含：**
- 完整的数据结构定义（TypeScript 接口）
- 所有验证规则的实现代码
- 状态计算和调度算法
- 确定性的事实提取逻辑
- 完整的 JSON 输出契约

**不应包含：**
- 对"好"或"坏"的语义判断
- 需求是否完整的评价
- 代码质量的评估
- 用户意图的推断

## 边界示例

### 示例 1：需求文档头部

❌ **错误**：在 `hx-doc.md` 中列出头部字段
```markdown
## 约束
- 头部包含 Feature、Display Name、Source ID、Source Fingerprint、Type 五个字段
- 字段必须按此顺序出现
- Feature 值不能为空
```

✅ **正确**：引用脚本定义
```markdown
## 约束
- 头部字段格式、顺序和验证规则由 `scripts/lib/feature-header.ts` 定义，以脚本返回的事实为准
- 先复用后生成，已有头部字段优先沿用脚本返回的 `existingHeader`
```

### 示例 2：任务调度

❌ **错误**：在 `hx-run.md` 中描述调度逻辑
```markdown
## 约束
- 先找出所有 status='in-progress' 且 dependsOn 已完成的任务
- 再找出所有 status='pending' 且 dependsOn 已完成的任务
- 优先执行 in-progress 任务
```

✅ **正确**：引用脚本实现
```markdown
## 约束
- 任务调度逻辑由 `scripts/lib/task-scheduler.ts` 实现，包括可恢复任务、可运行任务和批次优先级
- 未显式指定时只处理脚本返回的当前批次任务
```

### 示例 3：流水线步骤

❌ **错误**：在 `hx-go.md` 中硬编码规则
```markdown
## 约束
- 自动恢复时不得跳过最早未完成的 step
- --from 参数必须是有效的 step 名称
- 按 doc → plan → run → check → mr 顺序执行
```

✅ **正确**：引用脚本和配置
```markdown
## 约束
- 流水线步骤定义、状态解析和下一步计算由 `scripts/lib/pipeline-runner.ts` 实现
- 流水线配置从 `.hx/config.yaml` 读取，默认使用 `default` 流水线
- `--from <step>` 必须是脚本验证过的有效 step 名称
```

## 确定性 vs 语义判断

### 确定性事实（脚本负责）

- 文件是否存在
- JSON 格式是否合法
- 字段是否按规定顺序出现
- 依赖任务是否已完成
- Gate 命令的 exit code
- Pipeline step 的状态值

### 语义判断（AI 负责）

- 需求描述是否完整
- 代码实现是否正确
- 计划是否合理
- 是否需要重新评审
- 错误信息如何向用户解释

## 数据流向

```
配置文件 (.hx/config.yaml)
    ↓
脚本读取配置 (runtime-config.ts)
    ↓
工具脚本返回事实 (tools/*.ts → JSON)
    ↓
AI 读取 JSON 事实
    ↓
AI 根据提示词约束做语义判断
    ↓
AI 调用脚本更新状态（如 progress.ts）
```

## 修改指南

### 修改验证规则时

1. 更新 `scripts/lib/*.ts` 中的验证逻辑
2. 确保工具脚本 `scripts/tools/*.ts` 调用更新后的验证函数
3. 检查命令提示词 `commands/hx-*.md` 的引用是否仍然准确
4. 更新单元测试 `tests/unit/*.test.ts`
5. 验证集成测试 `tests/integration/*.test.ts` 仍然通过

### 修改命令行为时

1. 优先在 `scripts/lib/*.ts` 添加或修改逻辑
2. 在 `scripts/tools/*.ts` 暴露新的子命令或选项
3. 更新 `commands/hx-*.md` 的执行步骤和约束说明
4. 同步更新 `.hx/*` 中的模板（如果是初始化相关）
5. 确保 self-hosting 场景下仓库自身行为一致

### 添加新命令时

1. 在 `scripts/lib/*.ts` 实现核心逻辑
2. 在 `scripts/tools/*.ts` 创建新的工具脚本
3. 在 `commands/hx-*.md` 创建命令提示词
4. 在 `SKILL.md` 中添加路由
5. 补充测试和文档

## 常见反模式

### ❌ 反模式 1：提示词包含硬编码枚举

```markdown
## 约束
- scope 可以是 review、clean、qa 之一
```

**问题**：配置变更时需要同步更新提示词

**修正**：引用脚本或配置
```markdown
## 约束
- 检查范围由脚本返回的 `scope` 字段和 `.hx/config.yaml` 定义
```

### ❌ 反模式 2：脚本包含主观判断

```typescript
// 不好
if (coverage < 80) {
  return { ok: false, message: '测试覆盖率太低，代码质量不合格' }
}

// 更好
return {
  ok: true,
  coverage,
  threshold: 80,
  needsAiReview: coverage < 80
}
```

**问题**：脚本不应该判断"合格"与否，只应提供事实

**修正**：返回数据和阈值，让 AI 判断

### ❌ 反模式 3：提示词重复脚本文档

```markdown
## 执行步骤
1. 调用 doc.ts context
   - 该命令接受 --type feature|bugfix
   - 返回 requirementDoc、docExists、headerTemplate 等字段
   - 如果文档存在，返回 existingHeader
```

**问题**：脚本修改时提示词也要改

**修正**：只说明调用意图
```markdown
## 执行步骤
1. 执行 `bun scripts/tools/doc.ts context <feature>`，读取需求来源、模板和现有文档事实
```

## 测试策略

### 单元测试（tests/unit/）

- 测试脚本库的验证逻辑
- 测试数据结构解析
- 测试任务调度算法
- 不依赖提示词内容

### 集成测试（tests/integration/）

- 测试工具脚本的 JSON 输出
- 测试命令链路（doc → plan → run → check）
- 验证提示词引用的脚本确实存在
- 不测试 AI 语义判断的正确性

## 后续改进方向

1. **JSON Schema 契约化**
   - 为每个工具脚本的输出定义 JSON Schema
   - 在提示词中引用 Schema URL 而非描述字段

2. **事实 vs 语义标记**
   - 在脚本输出中明确标记哪些是确定性事实（`facts`）
   - 哪些需要 AI 判断（`needsAiReview`、`needsInterpretation`）

3. **运行时契约验证**
   - 添加 `--verify-contract` 选项检查输出格式
   - CI 中自动验证所有工具脚本的输出结构

4. **提示词模板化**
   - 将"约束"部分的脚本引用提取为可复用片段
   - 避免在多个命令中重复相同的引用说明
