# 执行计划：{feature-key}

> 创建于 {date}｜Profile：{team}｜关联需求文档: {requirement-path}

## 执行规则

- 每个 TASK 独立开 Agent 会话执行
- 按架构层级从内到外串行执行
- 每个 TASK 完成后运行当前 Profile 对应的质量门控
- 门控通过后更新进度文件，开始下一个 TASK

## 任务列表

<!-- 由 /hx-plan 根据 Profile 的 task_split.template 自动生成 -->

```
{task-list}
```

## 依赖关系

```
{dependency-graph}
```

## 进度追踪

进度文件: `{feature-key}-progress.json`
