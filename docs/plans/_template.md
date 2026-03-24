# 执行计划：[feature-name]

> 创建于 YYYY-MM-DD｜关联需求文档: [docs/requirement/feature-name.md](../requirement/feature-name.md)

## 执行规则

- 每个 TASK 独立开 Agent 会话执行
- 每个 TASK 完成后运行当前 profile 对应的质量门控，通过后开 PR
- PR 合并后运行 `npm run hx:done -- TASK-XX-NN` 更新进度

## 后端任务

```
TASK-BE-01: Types 层
  输出: src/types/[feature].ts
  内容: 请求体、响应体、错误类型定义

TASK-BE-02: Repo 层
  输出: src/repo/[entity]Repo.ts
  方法: 数据查询，不含业务逻辑

TASK-BE-03: Service 层
  输出: src/service/[feature]Service.ts
  方法: 核心业务逻辑，引用 Repo 层

TASK-BE-04: Controller 层
  输出: src/runtime/[feature]Controller.ts
  职责: 参数校验、调用 Service、格式化响应

TASK-BE-05: 单元测试
  输出: src/service/[feature]Service.test.ts
  覆盖: 所有 AC + 主要错误路径
```

## 前端任务

```
TASK-FE-01: [ComponentName] 组件
  输出: src/components/[domain]/[ComponentName].tsx
  Props: 在 docs/requirement/[feature].md 中定义

TASK-FE-02: use[Feature] Hook
  输出: src/hooks/use[Feature].ts
  职责: 调用 API，管理 loading/error 状态

TASK-FE-03: 页面集成
  输出: src/pages/[PageName].tsx
  职责: 组合组件 + Hook，处理路由跳转

TASK-FE-04: 单元测试
  输出: src/components/[domain]/[ComponentName].test.tsx
```

## 进度追踪

进度文件: `[feature-name]-progress.json`（由 `npm run hx:plan` 自动生成）
