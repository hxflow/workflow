# 服务端 Profile 说明

本目录定义服务端团队在 Harness 流程中的默认规则，适用于 `--profile backend`。

## 文件职责

- `profile.yaml`：团队元信息、架构层级、任务拆分、门控命令、QA 要求
- `requirement-template.md`：Phase 01 需求文档模板
- `plan-template.md`：Phase 02 执行计划模板
- `golden-rules.md`：服务端专属黄金原则
- `review-checklist.md`：Phase 05 审查清单

## 架构规则

依赖方向：`Types -> Config -> Repo -> Service -> Runtime`。

- `Types` 只放类型定义，不含运行时逻辑
- `Repo` 只做数据访问，不写业务判断
- `Service` 放核心业务逻辑，必须配套单元测试
- `Runtime` 负责路由、参数校验、响应格式化

## 任务拆分

默认按层拆分：`Types -> Repo -> Service -> Runtime -> Test`，任务前缀为 `TASK-BE`。

## 重点规则

- Repo 层禁止业务判断
- Controller 统一 `AppError -> HTTP` 映射
- 配置值提取到 `src/config/`
- 文档中的错误码体系必须同步维护

## 门控命令

- `lint`: `golangci-lint run ./...`
- `build`: `go build ./...`
- `test`: `go test ./... -v -count=1`
- `arch`: `go vet ./...`

## 使用方式

```bash
npm run hx:doc -- user-login --profile backend
npm run hx:plan -- user-login --profile backend
npm run hx:run -- user-login TASK-BE-01 --profile backend
```
