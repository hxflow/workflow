# Skill Resolution

- 这里定义工作流 skill 解析与代理适配层的公共规则。

## 三层 skill 源

- 项目层：`<project>/.hx/commands/`
- 用户层：`~/.hx/commands/`
- 框架层：`src/commands/`

## 解析顺序

- 普通 skill 按以下顺序读取第一个存在的实体文件：
  1. 项目层
  2. 用户层
  3. 框架层
- 不做多层 merge，命中即停止。

## protected

- `protected: true` 的 skill 只允许读取框架层实体文件。
- 用户层和项目层都不能覆盖这类 skill。

## 代理适配层

- `hx setup` 会根据这份规则生成：
  - `~/.claude/skills/*/SKILL.md`
  - `~/.codex/skills/*/SKILL.md`
- 这些文件只负责把 skill 请求转发到最终命中的实体文件。
- 适配层不承载 skill 业务逻辑。

## 失败处理

- 三层都找不到 skill 实体文件时，直接报错。
- `protected` skill 若框架层文件缺失，也直接报错。
