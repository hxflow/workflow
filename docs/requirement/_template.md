# 需求：[feature-name]

> 创建于 YYYY-MM-DD｜状态：草稿 / 评审中 / 已确认

## 背景

<!-- 说明这个需求的来源和动机，1-3 句话 -->

## 验收标准（AC）

<!-- 每条 AC 必须可以被自动化测试验证 -->
<!-- 使用具体的 HTTP 方法、字段名、状态码、计数值 -->

- AC-001: POST /api/[path] 接收 { field1, field2 }，返回 { result }
- AC-002: 当 [条件] 时，返回 [HTTP 状态码]，body: { code: "ERROR_CODE" }
- AC-003: [边界情况]

## 影响的架构层级

- [ ] Types    — src/types/
- [ ] Config   — src/config/
- [ ] Repo     — src/repo/
- [ ] Service  — src/service/
- [ ] Runtime  — src/runtime/
- [ ] UI       — src/components/ src/pages/ src/hooks/

## 接口定义

### 请求

```typescript
// 填写请求体类型（将同步到 src/types/）
interface FeatureRequest {
  field1: string
  field2: number
}
```

### 响应

```typescript
// 填写响应体类型
interface FeatureResponse {
  result: string
  createdAt: Date
}
```

### 错误码

| Code | HTTP | 触发条件 |
|------|------|----------|
| FEATURE_ERROR | 400 | 当… |

## 边界约束（不做什么）

- 本期不做：
- 本期不做：

## 依赖文档

- （无）

## 设计决策

| 决策点 | 选择 | 原因 |
|--------|------|------|
| | | |
