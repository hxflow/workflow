# Harness Profiles — 团队自定义配置

每个团队目录下包含以下文件，流水线命令（/hx-go 等）会根据选择的 profile 加载对应配置。

## 继承体系

```
base/                          ← 根基类（通用规则、模板、执行规范）
├── backend/                   ← extends base（服务端）
├── frontend/                  ← extends base（前端）
├── mobile/                    ← extends base（移动端通用）
│   └── platforms/
│       ├── ios.yaml           ← extends mobile（iOS 特化）
│       ├── android.yaml       ← extends mobile（Android 特化）
│       └── harmony.yaml       ← extends mobile（HarmonyOS 特化）
└── (用户自定义/)               ← extends 任意 Profile
```

## 文件结构

```
profiles/
├── base/                      # 根基类
│   ├── profile.yaml           # 通用配置（执行规则、commit 格式、通用审查项）
│   ├── golden-rules.md        # 通用黄金原则 GP-BASE-001~009
│   ├── review-checklist.md    # 通用审查清单
│   ├── requirement-template.md
│   ├── plan-template.md
│   └── README.md
├── backend/
│   ├── profile.yaml           # extends: base + 架构层级 + 门控命令
│   ├── golden-rules.md        # GP-BE-001~005（补充 base）
│   ├── review-checklist.md    # 服务端专项检查（补充 base）
│   ├── requirement-template.md # 服务端需求模板（覆盖 base）
│   ├── plan-template.md
│   └── README.md
├── frontend/                  # 结构同上
├── mobile/
│   ├── profile.yaml           # extends: base + Clean Architecture
│   ├── ...
│   └── platforms/             # 平台特化（覆盖 mobile 的差异项）
│       ├── ios.yaml
│       ├── android.yaml
│       └── harmony.yaml
└── README.md                  # 本文件
```

## Profile 加载优先级

```
1. base/profile.yaml                        — 始终加载（根基类）
2. {team}/profile.yaml                      — 按 extends 链向上合并
3. mobile/platforms/{platform}.yaml          — 移动端额外加载（覆盖通用）
4. 全局文档（AGENTS.md、golden-principles.md）— 始终加载
```

## 覆盖规则

- **对象字段**：deepMerge（子级递归合并到父级）
- **数组字段**：子级整体替换父级
- **标量字段**：子级直接覆盖父级
- **未定义字段**：继承父级的值

## 使用方式

```bash
/hx-go user-login --profile backend        # 服务端
/hx-go user-login --profile frontend       # 前端
/hx-go user-login --profile mobile:ios     # 移动端 iOS
/hx-go user-login --profile mobile:android # 移动端 Android
/hx-go user-login --profile mobile:harmony # 移动端 HarmonyOS
```

## 创建自定义 Profile

在 `.harness/profiles/` 或 `profiles/` 下创建目录，profile.yaml 中声明 `extends`:

```yaml
name: backend-go-ddd
label: Go后端(DDD)
extends: backend          # 继承 backend，backend 继承 base
task_prefix: TASK-GO

architecture:
  layers:                 # 覆盖 backend 的层级定义
    - id: domain
      path: domain/
      can_import: []
    # ...
```
