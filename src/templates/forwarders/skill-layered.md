---
name: {{name}}
description: {{description}}
---
<!-- hx-skill: {{name}} — 由 hx setup 自动生成，请勿手动修改 -->

按以下优先级找到第一个存在的文件，读取其完整内容作为指令执行（$ARGUMENTS 原样透传）：

1. 从当前目录向上查找含 `.hx/config.yaml` 或 `.git` 的项目根目录，读取 `<项目根>/.hx/commands/{{name}}.md`
2. `{{userCommandPath}}`
3. `{{systemPath}}`

若文件不存在，报错：`{{name}} skill 实体文件未找到，请重新安装包或运行 hx setup 修复。`
