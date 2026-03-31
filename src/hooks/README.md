# Framework Hooks

- Hook 是命令前后可插入的轻量扩展点。
- skill 是否支持 Hook，取决于 frontmatter 中的 `hooks` 字段，见 `src/commands/README.md`。

## 命名

- 统一命名：
  - `pre_<command>.md`
  - `post_<command>.md`
- 示例：
  - `hx-doc` -> `pre_doc.md` / `post_doc.md`
  - `hx-mr` -> `pre_mr.md` / `post_mr.md`

## 查找与执行

- Hook 不是覆盖规则，而是中间件链。
- 三层来源：
  - 框架层 `src/hooks/`
  - 用户层 `~/.hx/hooks/`
  - 项目层 `.hx/hooks/`
- `pre_*` 执行顺序：
  - 框架层 -> 用户层 -> 项目层
- `post_*` 执行顺序：
  - 项目层 -> 用户层 -> 框架层
- 某层不存在对应文件时直接跳过。

## 输入

- 每个 Hook 都接收同一个结构化上下文对象。
- 固定字段：
  - `command`: 当前命令名，例如 `hx-doc`
  - `phase`: `pre` 或 `post`
  - `projectRoot`: 当前项目根目录
  - `feature`: 当前需求标识；若尚未生成可为空
  - `paths`: 当前解析后的 `paths.*`
  - `gates`: 当前解析后的 `gates.*`
  - `arguments`: 当前命令参数
  - `context`: 当前命令共享上下文

## 输出

- Hook 只能返回结构化结果。
- 固定字段：
  - `patch`: 追加到共享上下文的补丁对象
  - `warnings`: 非阻断告警列表
  - `abort`: 是否中止后续执行
  - `message`: 对用户的说明
  - `artifacts`: 产出的外部结果，例如 URL、ID、记录信息
- 规则：
  - `patch` 会合并进上下文，再传给后续 Hook 或主命令
  - `abort: true` 时必须同时返回 `message`
  - `pre_*` 中断后，主命令不再继续
  - `post_*` 中断后，后续 `post_*` 不再继续，但主命令结果已产生

## 边界

- Hook 负责扩展，不负责改写主命令核心语义。
- Hook 不应：
  - 重算已确定的 `feature`
  - 直接覆盖主命令核心输出格式
  - 让命令依赖隐式副作用才能成立

## 建议

- 需要补输入，用 `patch.context`
- 需要做交付、通知、回写，放在 `post_*`
- 业务系统特有字段放在 `context` 的自定义 key 下，不放进框架公共字段
