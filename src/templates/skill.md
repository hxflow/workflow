---
name: {{name}}
description: "{{description}}"
compatibility: "Requires bun runtime and @hxflow/cli package"
metadata:
  generator: hx-setup
  framework: "@hxflow/cli"
---
<!-- hx-skill: {{name}} — 由 hx setup 自动生成，请勿手动修改 -->

读取 [运行时契约](references/runtime-contract.md) 作为入口规则，然后读取 [命令定义](references/{{name}}.md) 执行命令（$ARGUMENTS 原样透传）。

若引用文件不存在，运行 `hx setup` 修复。
