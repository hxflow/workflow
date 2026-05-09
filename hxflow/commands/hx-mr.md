# 创建 Merge Request

## 执行步骤

1. 先执行 `git status --porcelain`；存在未提交修改时，先按团队规范提交当前修改。
2. 执行 `git push origin <current-branch>`，确保远端分支与本地一致；push 失败则终止。
3. 基于需求文档、计划/进度和已提交变更生成 MR 标题与描述，再创建 MR。
4. MR 创建成功后执行 `hx-mr archive <feature>`；创建失败不归档。

## 约束

- 不允许在 MR 阶段生成或重算需求、计划、任务
- 未完成 task 存在时直接失败
- 未提交修改必须先提交，不允许跳过提交直接创建 MR
- 归档统一写入 `docs/archive/{feature}/`
