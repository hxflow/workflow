# 执行计划：[feature-name]

> 创建于 YYYY-MM-DD｜团队：移动端｜平台：{platform}｜关联需求文档: [docs/requirement/feature-name.md](../../docs/requirement/feature-name.md)

## 执行规则

- 每个 TASK 独立开 Agent 会话执行
- 按 Clean Architecture 从内到外：Domain → Data → Presentation → UI → Test
- 每个 TASK 完成后运行质量门控
- Domain 层代码三端共享，平台差异集中在 Data/UI 层

## 目标平台

- [ ] iOS（SwiftUI）— 最低 iOS 16.0
- [ ] Android（Jetpack Compose）— 最低 API 26
- [ ] HarmonyOS（ArkUI）— 最低 API 12

## 任务列表

```
TASK-MB-01: Domain 层
  输出: {platform_src}/domain/{feature}/
  内容: 实体定义、Use Case 接口、Repository 协议
  关联 AC:

TASK-MB-02: Data 层
  输出: {platform_src}/data/{feature}/
  内容: API 请求实现、本地缓存、Repository 实现
  关联 AC:

TASK-MB-03: Presentation 层
  输出: {platform_src}/presentation/{feature}/
  内容: ViewModel、状态管理、UI 事件处理
  关联 AC:

TASK-MB-04: UI 层
  输出: {platform_src}/ui/{feature}/
  内容: 页面视图、组件、导航
  关联 AC:

TASK-MB-05: 单元测试
  输出: {platform_test}/{feature}/
  覆盖: Domain + Presentation 层测试，Mock Data 层
  关联 AC: 全部
```

## 依赖关系

```
TASK-MB-01 → TASK-MB-02 → TASK-MB-03 → TASK-MB-04
                                          ↓
                                      TASK-MB-05
```

## 平台特殊考虑

### 离线策略
<!-- 网络不可用时的数据处理 -->

### 权限申请
<!-- 需要的系统权限列表 -->

## 进度追踪

进度文件: `{feature-name}-progress.json`
