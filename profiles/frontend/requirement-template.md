# 需求：{feature-name}

> 创建于 {date}｜状态：草稿｜团队：前端

## 背景

<!-- 1-3 句话说明需求来源 -->

## 设计稿

- Figma: <!-- 必填，URL 或截图路径 -->
- 交互说明: <!-- 如有 -->

## 验收标准（AC）

<!-- 每条 AC 包含可测试的具体行为 -->

- AC-001:
- AC-002:
- AC-003:

## 组件设计

### Props 接口

```typescript
interface {Component}Props {
  // 明确定义，不允许 Agent 自行推断
}
```

### 状态管理方案

- 全局 Store:
- 本地 State:
- 通过 API 获取:

### 复用的现有组件

- src/components/ui/ 中的:

## 影响的架构层级

- [ ] Types — src/types/
- [ ] API Services — src/services/
- [ ] Stores — src/stores/
- [ ] Hooks — src/hooks/
- [ ] Components — src/components/
- [ ] Pages — src/pages/

## 响应式要求

- 移动端（≤ 375px）：
- 平板（768px ~ 1024px）：
- 桌面端（≥ 1440px）：

## 边界约束（不做什么）

-
-

## 依赖文档

- <!-- 后端接口文档、设计系统文档等 -->
