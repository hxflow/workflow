# 系统架构地图

> 本仓库不是单一应用，而是一个 profile-driven workflow framework。实际架构以当前任务选择的 `--profile` 为准。

## 架构选择规则

- 后端任务读取 `profiles/backend/profile.yaml`
- 前端任务读取 `profiles/frontend/profile.yaml`
- 移动端任务读取 `profiles/mobile/profile.yaml`，再叠加 `profiles/mobile/platforms/*.yaml`
- 所有层级依赖关系以 `architecture.layers` 和 `can_import` 字段为准

## 后端架构

依赖方向：`Types → Config → Repo → Service → Runtime`

| 层级 | 目录 | 职责 |
|------|------|------|
| Types | `src/types/` | 类型与契约定义 |
| Config | `src/config/` | 配置、常量、环境变量 |
| Repo | `src/repo/` | 数据访问，不写业务判断 |
| Service | `src/service/` | 核心业务逻辑 |
| Runtime | `src/runtime/` | 路由、参数校验、响应格式化 |

## 前端架构

依赖方向：`Types → Services → Stores → Hooks → Components → Pages`

| 层级 | 目录 | 职责 |
|------|------|------|
| Types | `src/types/` | 类型与接口定义 |
| Services | `src/services/` | API 调用与外部服务封装 |
| Stores | `src/stores/` | 全局状态管理 |
| Hooks | `src/hooks/` | 数据编排与状态复用 |
| Components | `src/components/` | 展示组件 |
| Pages | `src/pages/` | 页面组装与路由入口 |

## 移动端架构

依赖方向：`Domain → Data → Presentation → UI`

| 层级 | 目录 | 职责 |
|------|------|------|
| Domain | `{platform_src}/domain/` | 实体、用例、协议 |
| Data | `{platform_src}/data/` | API、本地存储、缓存 |
| Presentation | `{platform_src}/presentation/` | ViewModel / 状态管理 |
| UI | `{platform_src}/ui/` | 页面、组件、导航与交互 |

## 横切关注点

以下能力不属于单一业务层，统一通过协议、Provider 或基础设施注入：

- Auth
- Telemetry
- Feature Flags
- Error Mapping

## 维护要求

- 新增团队规则时，先更新对应 `profiles/*/profile.yaml`
- 新增或修改需求时，同步更新 `docs/requirement/*.md`
- 新增或修改任务拆分时，同步更新 `docs/plans/*.md` 与 `*-progress.json`
