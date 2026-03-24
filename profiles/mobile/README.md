# 移动端 Profile 说明

本目录定义移动端团队的通用规则，适用于 `--profile mobile:*`。移动端采用“通用配置 + 平台覆盖”模式。

## 文件职责

- `profile.yaml`：移动端通用架构、任务拆分、审查重点、QA 要求
- `platforms/*.yaml`：iOS / Android / HarmonyOS 平台差异覆盖
- `requirement-template.md`：Phase 01 需求文档模板
- `plan-template.md`：Phase 02 执行计划模板
- `golden-rules.md`：移动端专属黄金原则
- `review-checklist.md`：Phase 05 审查清单

## 架构规则

依赖方向：`Domain -> Data -> Presentation -> UI`。

- `Domain` 必须保持纯逻辑，不能引入平台 API
- `Data` 负责网络、本地存储和缓存
- `Presentation` 负责 ViewModel / 状态管理
- `UI` 只负责渲染和交互，不能直连 Data

## 任务拆分

默认按 Clean Architecture 拆分：`Domain -> Data -> Presentation -> UI -> Test`。

- 通用前缀为 `TASK-MB`
- iOS 覆盖为 `TASK-IOS`
- Android 覆盖为 `TASK-AND`
- HarmonyOS 覆盖为 `TASK-HM`

## 平台选择

务必带完整 profile：

```bash
--profile mobile:ios
--profile mobile:android
--profile mobile:harmony
```

只写 `mobile` 时只能加载通用规则，拿不到平台特定路径、门控命令和约束。

## 重点规则

- Domain 层禁止平台 API
- UI 层禁止直接调用 Data
- ViewModel 状态保持不可变
- UI 更新必须在主线程
- 各平台额外限制见 `platforms/*.yaml`

## 使用方式

```bash
npm run hx:doc -- order-detail --profile mobile:ios
npm run hx:plan -- order-detail --profile mobile:ios
npm run hx:run -- order-detail TASK-IOS-01 --profile mobile:ios
```
