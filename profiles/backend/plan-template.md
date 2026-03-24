# 执行计划：[feature-name]

> 创建于 YYYY-MM-DD｜团队：服务端｜关联需求文档: [docs/requirement/feature-name.md](../../docs/requirement/feature-name.md)

## 执行规则

- 每个 TASK 独立开 Agent 会话执行
- 按架构层级从内到外串行：Types → Repo → Service → Runtime → Test
- 每个 TASK 完成后运行质量门控

## 任务列表

```
TASK-BE-01: Types 层
  输出: src/types/{feature}.ts
  内容: 请求体、响应体、错误类型定义
  关联 AC:

TASK-BE-02: Repo 层
  输出: src/repo/{entity}Repo.ts
  方法: 数据查询，不含业务逻辑
  关联 AC:

TASK-BE-03: Service 层
  输出: src/service/{feature}Service.ts
  方法: 核心业务逻辑，引用 Repo 层
  关联 AC:

TASK-BE-04: Controller 层
  输出: src/runtime/{feature}Controller.ts
  职责: 参数校验、调用 Service、AppError → HTTP 状态码
  关联 AC:

TASK-BE-05: 单元测试
  输出: src/service/{feature}Service.test.ts
  覆盖: 所有 AC + 主要错误路径
  关联 AC: 全部
```

## 依赖关系

```
TASK-BE-01 → TASK-BE-02 → TASK-BE-03 → TASK-BE-04
                                          ↓
                                      TASK-BE-05
```

## 进度追踪

进度文件: `{feature-name}-progress.json`
