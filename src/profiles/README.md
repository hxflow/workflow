# Harness Profiles — 团队自定义配置

框架内置只保留 `base/`。Profile 由同一套 canonical `hx-*` command contract 读取，Claude 使用 `/hx-*`，Codex 使用 `hx-*`，两边共享同一套 profile 解析规则。

## 三层查找顺序

Profile 按以下优先级查找，命中后再按 `extends` 继续向上合并：

```text
1. <project>/.hx/profiles/<name>/
2. ~/.hx/profiles/<name>/
3. <frameworkRoot>/profiles/<name>/
```

框架层只保证 `base/` 存在；其他 profile 由用户层或项目层维护。

## 继承体系

```text
base/                          ← 内置根基类（通用规则、模板、执行规范）
└── my-team/                   ← 用户/项目自定义 profile，可 extends: base
    └── my-team-mobile/        ← 继续扩展共享 profile
```

## 目录结构

```text
profiles/
├── base/
│   ├── profile.yaml
│   ├── golden-rules.md
│   ├── review-checklist.md
│   ├── requirement-template.md
│   ├── plan-template.md
│   └── README.md
├── my-team/
│   ├── profile.yaml
│   ├── golden-rules.md
│   ├── review-checklist.md
│   ├── requirement-template.md
│   ├── plan-template.md
│   └── README.md
└── README.md
```

## 合并规则

- 对象字段：递归合并，子级覆盖父级同名键
- 数组字段：子级整体替换父级
- 标量字段：子级直接覆盖父级
- 未定义字段：继承父级的值

## 使用方式

标准命令统一使用 `hx-*`：

```text
Claude: /hx-doc user-login --profile base
Codex:  hx-doc user-login --profile base

Claude: /hx-plan user-login --profile my-team
Codex:  hx-plan user-login --profile my-team

Claude: /hx-qa --profile my-team
Codex:  hx-qa --profile my-team
```

## 创建自定义 Profile

在项目层或用户层创建 `profiles/<name>/profile.yaml`，并显式声明 `extends`：

```yaml
extends: base
label: Go 后端 DDD
task_prefix: TASK-GO

gate_commands:
  lint: golangci-lint run ./...
  test: go test ./... -count=1

architecture:
  layers:
    - id: domain
      path: domain/
      can_import: []
```

## 设计约束

- Profile 只描述规则、模板、路径和门控，不承载业务需求内容
- 需求文档、计划文档、进度文件属于运行时上下文，不参与 profile 合并
- 自定义 profile 应优先放在 `.hx/profiles/` 或 `~/.hx/profiles/`，不要直接改框架内置 `base/`
