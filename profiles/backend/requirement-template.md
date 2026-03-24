# 需求：{feature-name}

> 创建于 {date}｜状态：草稿｜团队：服务端

## 背景

<!-- 1-3 句话说明需求来源 -->

## 验收标准（AC）

<!-- 每条 AC 包含：HTTP 方法 + 路径 + 请求体 + 响应体 + 状态码 -->

- AC-001:
- AC-002:
- AC-003:

## 接口定义

### 请求

```typescript
interface {Feature}Request {
  // 与前端/移动端对齐的契约类型
}
```

### 响应

```typescript
interface {Feature}Response {
  // 标准响应结构
}
```

### 错误码

| Code | HTTP | 触发条件 |
|------|------|----------|
|      |      |          |

## 影响的架构层级

- [ ] Types — src/types/
- [ ] Config — src/config/
- [ ] Repo — src/repo/
- [ ] Service — src/service/
- [ ] Runtime — src/runtime/

## 非功能性要求

- P95 响应时间：
- QPS 目标：
- 限流阈值：

## 边界约束（不做什么）

-
-

## 依赖文档

- docs/requirement/error-codes.md（错误码体系）

## 设计决策

| 决策 | 选项 | 原因 |
|------|------|------|
|      |      |      |
