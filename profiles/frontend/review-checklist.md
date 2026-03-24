# 前端代码审查清单

> Phase 05 使用，逐项检查 diff 中的变更。

## 🔴 必须修复（阻断合并）

- [ ] **GP-FE-001** — 组件文件未直接调用 fetch/axios，通过 Hook 或 Service 封装
- [ ] **GP-FE-002** — 单个组件文件不超过 200 行
- [ ] **GP-FE-003** — 无内联样式对象（提取常量或 CSS Module）
- [ ] **架构合规** — Components 层未直接导入 Services/Stores
- [ ] **GP-003** — 无裸 `throw new Error`
- [ ] **GP-001** — src/ 中无 `console.log`
- [ ] **Props 一致性** — Props 接口与需求文档中定义一致

## 🟡 建议修复

- [ ] **GP-FE-004** — 表单有 label、图片有 alt、交互元素可键盘操作
- [ ] **GP-FE-005** — 新增页面在 375px / 768px / 1440px 三断点验证
- [ ] **GP-009** — 无 `: any` 类型泄漏
- [ ] **UI 组件复用** — 是否绕过了 src/components/ui/ 已有组件
- [ ] **状态管理** — 全局 Store vs 本地 state 使用是否合理

## ⚪ 观察项

- [ ] 过度抽象：只用一次的逻辑被提取为 Hook/HOC
- [ ] 冗余注释：对自解释代码添加无意义注释
- [ ] 不必要的 `as XXX` 类型断言
- [ ] Bundle 影响：新增依赖体积评估
