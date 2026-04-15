# Runtime Contract

- 本文件是所有 `hx-*` 命令的系统层 prompt。
- 作用：定义默认读取项、按需读取规则、命令执行入口顺序。

## 默认读取

- `src/contracts/command-contract.md`

## 按需读取

- 命令正文显式提到哪个 contract，就继续读取哪个 contract。
- 不涉及的对象不要主动读取。
- 不要一次性读取整个 `src/contracts/`。

## 常见映射

- `feature` 相关：`src/contracts/feature-contract.md`
- `progressFile` / 调度 / 恢复：`src/contracts/progress-contract.md`
- pipeline：`src/contracts/pipeline-contract.md`
- 写权边界：`src/contracts/ownership-contract.md`
- checkpoint 评审：`src/contracts/checkpoint-contract.md`

## 事实工具模式

所有 `hx-*` 脚本是确定性的事实工具（fact tool）：
- 脚本通过子命令接口输出 JSON 结构化数据到 stdout
- AI 调用脚本获取事实，然后自行推理、分析和执行
- 脚本不做推理决策，AI 不做确定性计算
- 职责分离：**代码负责确定性事实，AI 负责推理分析**

### 子命令模式

每个脚本使用 `bun src/tools/<cmd>.ts <subcmd> [args]` 格式：
- `context` / `next`：收集当前阶段所需的事实上下文
- `validate`：校验产物是否合规
- `archive`：执行归档等确定性操作
- `state`：查询完整状态

### 返回格式

- 成功：`{"ok": true, ...}` + exit 0
- 失败：`{"ok": false, "error": "..."}` + exit 1

## 命令来源

- 所有 `hx-*` 命令实体文件统一位于框架层 `src/commands/`，不支持覆盖。
- Skill 入口（`~/.claude/skills/*/SKILL.md`、`~/.agents/skills/*/SKILL.md`）直接指向框架层文件。

## 执行入口

1. 先读取本文件。
2. 读取默认项。
3. 读取 `src/commands/` 中对应的命令实体文件。
4. 按命令正文显式引用继续按需读取其他 contracts。
5. 调用对应脚本子命令获取事实，AI 根据事实执行命令逻辑。
