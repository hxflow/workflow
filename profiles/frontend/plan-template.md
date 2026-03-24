# 执行计划：[feature-name]

> 创建于 YYYY-MM-DD｜团队：前端｜关联需求文档: [docs/requirement/feature-name.md](../../docs/requirement/feature-name.md)

## 执行规则

- 每个 TASK 独立开 Agent 会话执行
- 按组件优先策略：Types → Component → Hook → Page → Test
- 每个 TASK 完成后运行质量门控

## 任务列表

```
TASK-FE-01: Types 层
  输出: src/types/{feature}.ts
  内容: API 请求/响应类型，与后端契约对齐
  关联 AC:

TASK-FE-02: 组件
  输出: src/components/{domain}/{ComponentName}.tsx
  Props: 在需求文档中定义
  关联 AC:

TASK-FE-03: Hook
  输出: src/hooks/use{Feature}.ts
  职责: 调用 API，管理 loading/error 状态
  关联 AC:

TASK-FE-04: 页面集成
  输出: src/pages/{PageName}.tsx
  职责: 组合组件 + Hook，处理路由跳转
  关联 AC:

TASK-FE-05: 单元测试
  输出: src/components/{domain}/{ComponentName}.test.tsx
  覆盖: 组件渲染 + Hook 逻辑
  关联 AC: 全部
```

## 依赖关系

```
TASK-FE-01 → TASK-FE-02 → TASK-FE-04
                 ↓
           TASK-FE-03 → TASK-FE-04
                            ↓
                        TASK-FE-05
```

## 响应式验证断点

- 375px（移动端）
- 768px（平板）
- 1440px（桌面端）

## 进度追踪

进度文件: `{feature-name}-progress.json`
