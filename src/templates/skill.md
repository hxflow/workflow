---
name: {{name}}
description: {{description}}
---
<!-- hx-skill: {{name}} — 由 hx setup 自动生成，请勿手动修改 -->

读取 `{{runtimePath}}` 作为入口规则，然后读取 `{{commandPath}}` 执行命令（$ARGUMENTS 原样透传）。

若文件不存在，报错：`{{name}} skill 实体文件未找到，请重新安装包或运行 hx setup 修复。`
