# 前端 Profile 说明

本目录定义前端团队在 Harness 流程中的默认规则，适用于 `--profile frontend`。

## 文件职责

- `profile.yaml`：团队元信息、架构层级、任务拆分、门控命令、QA 要求
- `requirement-template.md`：Phase 01 需求文档模板
- `plan-template.md`：Phase 02 执行计划模板
- `golden-rules.md`：前端专属黄金原则
- `review-checklist.md`：Phase 05 审查清单

## 架构规则

依赖方向：`Types -> Services -> Stores -> Hooks -> Components -> Pages`。

- `Services` 只封装 API 调用，不掺 UI 逻辑
- `Hooks` 负责编排状态和数据获取，禁止组件直接 `fetch/axios`
- `Components` 保持展示性，通过 Props 接收数据
- `Pages` 负责组装组件、Hook 和路由

## 任务拆分

默认按组件优先拆分：`Types -> Component -> Hook -> Page -> Test`，任务前缀为 `TASK-FE`。

## 重点规则

- 组件文件不能直接请求接口
- 单组件文件不超过 200 行
- 优先复用 `src/components/ui/`
- 新增页面必须验证 375 / 768 / 1440 三个断点

## 门控命令

- `lint`: `npm run hx:lint`
- `type`: `npm run hx:type`
- `test`: `npm run hx:test`
- `arch`: `npm run hx:arch`

## 使用方式

```bash
npm run hx:doc -- user-login --profile frontend
npm run hx:plan -- user-login --profile frontend
npm run hx:run -- user-login TASK-FE-01 --profile frontend
```
