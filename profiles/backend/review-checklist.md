# 服务端代码审查清单

> Phase 05 使用，逐项检查 diff 中的变更。

## 🔴 必须修复（阻断合并）

- [ ] **架构层级合规**
  - Service 层是否导入了 Runtime/UI 模块
  - Repo 层是否包含业务逻辑（if/else 业务分支）
  - Types 层是否导入了其他层
- [ ] **GP-BE-001** — Repo 层仅做数据存取，不含业务判断
- [ ] **GP-BE-003** — Controller 统一 try-catch + AppError → HTTP 状态码映射
- [ ] **GP-003** — 无裸 `throw new Error`，统一使用 AppError
- [ ] **GP-001** — src/ 中无 `console.log`
- [ ] **GP-BE-004** — 无魔法数字，配置值提取到 src/config/
- [ ] **错误码** — 新增错误码已注册到 error-codes.md

## 🟡 建议修复

- [ ] **GP-BE-002** — Service 公共方法是否有对应单元测试
- [ ] **GP-009** — 无 `: any` 类型泄漏
- [ ] **GP-004** — Service 层是否有过度 try-catch（防御性编程）
- [ ] **日志字段** — 结构化日志包含 userId、action、durationMs
- [ ] **文档同步** — 接口参数变更是否同步到 docs/requirement/

## ⚪ 观察项

- [ ] 新增依赖是否合理（npm package 必要性）
- [ ] 数据库查询是否有 N+1 问题
- [ ] 接口响应时间是否有 P95 基线
