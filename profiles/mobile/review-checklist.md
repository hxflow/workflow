# 移动端代码审查清单

> Phase 05 使用，逐项检查 diff 中的变更。

## 🔴 必须修复（阻断合并）

- [ ] **GP-MB-001** — Domain 层未引入平台特定 API（UIKit/SwiftUI/Android SDK/ArkUI）
- [ ] **GP-MB-002** — UI 层未直接调用 Data 层，经过 Presentation 层
- [ ] **GP-MB-003** — ViewModel 状态为不可变值类型
- [ ] **GP-MB-004** — 所有 UI 更新在主线程
- [ ] **GP-MB-007** — ViewModel 未持有 View/Activity/UIViewController 强引用
- [ ] **架构合规** — 依赖方向：Domain ← Data ← Presentation ← UI

## 🟡 建议修复

- [ ] **GP-MB-005** — 列表使用懒加载（LazyColumn / LazyVStack / LazyForEach）
- [ ] **GP-MB-006** — 网络请求处理超时、无网络、服务端错误三种场景
- [ ] **GP-MB-008** — 图片加载使用缓存框架
- [ ] **离线策略** — 弱网/断网时的降级方案
- [ ] **深色模式** — 颜色适配是否完整

## ⚪ 观察项

- [ ] 启动性能：新增代码是否影响冷启动时间
- [ ] 横竖屏切换是否正常
- [ ] 无障碍：VoiceOver / TalkBack 可达

## 平台特化检查

### iOS
- [ ] 无 force unwrap（!），使用 guard let / if let
- [ ] Combine 订阅在 deinit 取消或 .store(in:)
- [ ] @MainActor 标注正确

### Android
- [ ] 无 !! 非空断言
- [ ] Coroutine 绑定 viewModelScope / lifecycleScope
- [ ] Hilt 注入正确

### HarmonyOS
- [ ] 统一 Stage 模型，无 FA 模型废弃 API
- [ ] @State 对象嵌套不超过 2 层
- [ ] LazyForEach 使用 DataChangeListener
