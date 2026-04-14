# Pipeline Contract

- pipeline 文件统一采用 `<name>.yaml` 命名，例如 `default.yaml`、`release.yaml`。
- pipeline 只定义流程编排，不承载命令正文。
- pipeline 的来源和优先级由 `src/contracts/resolution-contract.md` 定义。

## 数据结构

- 顶层必须包含 `name` 和 `steps`
- `name` 必须是非空字符串
- `steps` 必须是非空数组

### step 必填字段

- `id`：非空字符串，且在当前 pipeline 内唯一
- `name`：非空字符串
- `command`：非空字符串，值必须是 `hx-*` 命令名

### step 可选字段

- `phase`：展示用字符串
- `checkpoint.message`：非空字符串，存在时表示该步骤执行后暂停等待子 agent 评审，详见 `src/contracts/checkpoint-contract.md`
- `on_fail`：失败策略，当前只允许 `stop`

## 恢复规则

- `id` 同时是 `bun src/tools/go.ts --from <step-id>` 的恢复锚点
- `bun src/tools/go.ts` 是事实工具，不再 spawn 子进程执行步骤
- `bun src/tools/go.ts next` 返回下一步应执行的命令，AI 自行调用对应命令
- `bun src/tools/go.ts state` 返回流水线完整状态
- 未显式传入 `--from` 时，`bun src/tools/go.ts next` 按文件系统判断自动恢复位置
- 没有耐久完成标记的 step，不得自动判定为已完成
- 恢复时应从最近一个已完成耐久 step 的下一步重新执行

## 约束

- step 顺序即执行顺序
- 不允许空 step、匿名 step、重复 `id`
- 不允许在 pipeline 中内联命令正文或额外脚本逻辑
- 未声明的扩展字段默认不作为公共能力承诺
