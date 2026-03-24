# 移动端专属黄金原则

> 补充全局 golden-principles.md，以下规则适用于所有移动端平台。

**GP-MB-001** · Domain 层禁止引入任何平台特定 API（UIKit/SwiftUI/Android SDK/ArkUI），保持纯逻辑

**GP-MB-002** · UI 层禁止直接调用 Data 层（网络请求/数据库），必须经过 Presentation 层

**GP-MB-003** · ViewModel 中的状态必须为不可变值类型（data class / struct / readonly），禁止直接暴露可变集合

**GP-MB-004** · 所有 UI 更新必须在主线程执行，后台任务通过协程/GCD/TaskDispatcher 切换

**GP-MB-005** · 列表使用懒加载（LazyColumn / LazyVStack / LazyForEach），禁止一次性加载全量数据

**GP-MB-006** · 网络请求必须处理超时（默认 15s）、无网络、服务端错误三种场景，UI 给出对应状态

**GP-MB-007** · 禁止在 ViewModel 中持有 View/Activity/UIViewController 的强引用（内存泄漏）

**GP-MB-008** · 图片加载使用缓存框架（Kingfisher / Coil / 系统 Image），禁止手动管理图片内存

## 平台特定补充

### iOS
- 禁止 force unwrap（!），使用 guard let / if let
- Combine 订阅必须在 deinit 取消或使用 .store(in:)

### Android
- 禁止 !! 非空断言，使用 ?.let / requireNotNull
- Coroutine 必须绑定生命周期 scope（viewModelScope / lifecycleScope）

### HarmonyOS
- 禁止使用 FA 模型废弃 API，统一 Stage 模型
- @State 对象避免深层嵌套（超过 2 层导致无效刷新）
